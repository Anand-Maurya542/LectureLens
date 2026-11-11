import asyncio
import datetime
import logging
import os
from typing import Optional
from bson import ObjectId
from app.config import settings
from app.database import get_db
from app.services.memory import cleanup_memory, log_memory_status
from app.services.transcription import (
    transcribe_file,
    group_segments_into_paragraphs,
    unload_whisper_model,
)
from app.services.segmentation import segment_topics, unload_embedding_model
from app.services.summarization import generate_lecture_summaries
from app.services.quiz_generation import save_draft_quizzes
from app.services.vector_search import index_lecture_chunks
from app.services.youtube import fetch_youtube_transcript

logger = logging.getLogger("lecturelens.pipeline")

# Strict semaphore limiting concurrent pipeline executions to avoid Render 512MB/1GB OOM crashes
PIPELINE_SEMAPHORE = asyncio.Semaphore(settings.MAX_CONCURRENT_PIPELINE_JOBS)


async def run_lecture_processing_pipeline(
    lecture_id: str,
    media_path: Optional[str] = None,
    language_hint: Optional[str] = None,
):
    """Asynchronous background processing worker that executes:
    1. ASR Transcription (or YouTube caption extraction)
    2. Sequential model memory release (unloading Faster-Whisper before SentenceTransformers)
    3. Multilingual Topic Segmentation
    4. Extractive Summarization
    5. Search Chunk Generation and Vector Indexing
    6. Draft Quiz Generation
    7. Memory reclamation and status transition to 'review_required'
    """
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    logger.info(f"Queuing processing pipeline for lecture {lecture_id} (Concurrency limit: {settings.MAX_CONCURRENT_PIPELINE_JOBS})")

    # Set status to processing
    await db.lectures.update_one(
        {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
        {"$set": {"status": "processing", "updated_at": now}}
    )

    async with PIPELINE_SEMAPHORE:
        log_memory_status(f"Pipeline start [lecture {lecture_id}]")
        try:
            lec = await db.lectures.find_one(
                {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id}
            )
            if not lec:
                logger.error(f"Lecture {lecture_id} not found in database.")
                return

            source_type = lec.get("source_type", "upload")
            segments = []
            detected_language = "en"
            detected_prob = 1.0
            duration = 0.0

            # Fetch course-specific technical vocabulary/glossary to prime Faster-Whisper ASR
            course_glossary = []
            course_id = lec.get("course_id")
            if course_id:
                c_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"_id": course_id}
                course_doc = await db.courses.find_one(c_query)
                if course_doc and course_doc.get("glossary"):
                    course_glossary = [str(term).strip() for term in course_doc["glossary"] if str(term).strip()]

            initial_prompt = None
            hotwords = None
            if course_glossary:
                initial_prompt = f"Technical terminology and course vocabulary: {', '.join(course_glossary)}."
                hotwords = " ".join(course_glossary)
                logger.info(f"Applying technical glossary to lecture {lecture_id} ({len(course_glossary)} terms): {hotwords[:60]}...")

            if source_type == "upload":
                if not media_path or not os.path.exists(media_path):
                    raise FileNotFoundError(f"Media file not found at: {media_path}")

                # 1. Execute Faster-Whisper ASR
                asr_res = transcribe_file(
                    media_path,
                    language=language_hint,
                    initial_prompt=initial_prompt,
                    hotwords=hotwords,
                )
                segments = asr_res.get("segments", [])
                detected_language = asr_res.get("language", "en")
                detected_prob = asr_res.get("language_probability", 1.0)
                duration = asr_res.get("duration", segments[-1]["end"] if segments else 0.0)

                # CRITICAL MEMORY OPTIMIZATION: Unload Whisper before loading SentenceTransformers!
                # Having both models concurrently resident pushes memory past 512MB-1GB.
                if settings.UNLOAD_WHISPER_AFTER_TRANSCRIPTION:
                    unload_whisper_model()
                cleanup_memory(f"post_transcribe_lecture_{lecture_id}")

            elif source_type == "youtube":
                yt_id = lec.get("youtube_video_id")
                if not yt_id:
                    raise ValueError("YouTube video ID missing from lecture record.")

                yt_res = fetch_youtube_transcript(yt_id)
                if not yt_res["success"] or not yt_res["segments"]:
                    # If captions fail, fallback or flag review
                    raise RuntimeError(yt_res["message"])
                segments = yt_res["segments"]
                detected_language = yt_res.get("language", "en")
                duration = yt_res.get("duration", 0.0)

            if not segments:
                raise ValueError("No speech or text segments detected in the lecture source.")

            # Ensure original_text is preserved on every segment
            for idx, seg in enumerate(segments):
                seg["segment_index"] = idx
                if not seg.get("original_text"):
                    seg["original_text"] = seg.get("text", "")
                seg["is_edited"] = seg.get("is_edited", False)

            # Generate intelligent paragraphs combining consecutive sentences
            paragraphs = group_segments_into_paragraphs(segments)

            # Persist transcript segments to dedicated collection
            await db.transcript_segments.delete_many({"lecture_id": lecture_id})
            for seg in segments:
                seg["lecture_id"] = str(lecture_id)
            await db.transcript_segments.insert_many(segments)

            # 2. Semantic Topic Segmentation
            topics = segment_topics(segments)
            await db.topics.delete_many({"lecture_id": lecture_id})
            for top in topics:
                top["lecture_id"] = str(lecture_id)
            if topics:
                await db.topics.insert_many(topics)

            # 3. Extractive Summarization
            summaries = generate_lecture_summaries(topics)
            await db.summaries.delete_many({"lecture_id": lecture_id})
            for summ in summaries:
                summ["lecture_id"] = str(lecture_id)
            if summaries:
                await db.summaries.insert_many(summaries)

            # 4. Generate & Store Vector Search Chunks
            await index_lecture_chunks(
                lecture_id=str(lecture_id),
                course_id=str(lec.get("course_id", "")),
                topics=topics,
                is_published=lec.get("is_published", False),
            )

            # 5. Draft Quiz Generation
            await save_draft_quizzes(lecture_id=str(lecture_id), topics=topics)

            # Optional: unload embeddings if low-memory mode configured
            if settings.UNLOAD_EMBEDDINGS_AFTER_PIPELINE:
                unload_embedding_model()

            # 6. Update lecture to review_required
            update_payload = {
                "status": "review_required",
                "transcript_status": "ai_generated",
                "language": detected_language,
                "language_probability": detected_prob,
                "duration": duration,
                "segments": segments,
                "paragraphs": paragraphs,
                "topics": topics,
                "summaries": summaries,
                "failure_reason": None,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

            await db.lectures.update_one(
                {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
                {"$set": update_payload}
            )
            logger.info(f"Pipeline finished successfully for lecture {lecture_id}: review_required")

            # Final memory cleanup
            cleanup_memory(f"pipeline_complete_lecture_{lecture_id}")
            log_memory_status(f"Pipeline completed [lecture {lecture_id}]")

        except (Exception, MemoryError) as e:
            logger.exception(f"Pipeline error for lecture {lecture_id}: {e}")
            is_oom = isinstance(e, MemoryError) or "out of memory" in str(e).lower()
            failure_reason = (
                "Processing exceeded available memory limits. Recommended: upload audio-only or contact administrator."
                if is_oom
                else str(e)
            )

            # Emergency memory cleanup on failure
            try:
                unload_whisper_model()
                cleanup_memory("pipeline_error_recovery")
            except Exception:
                pass

            await db.lectures.update_one(
                {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
                {
                    "$set": {
                        "status": "failed",
                        "failure_reason": failure_reason,
                        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    }
                }
            )

