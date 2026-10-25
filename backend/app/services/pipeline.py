import datetime
import logging
import os
from typing import Optional
from bson import ObjectId
from app.database import get_db
from app.services.transcription import transcribe_file
from app.services.segmentation import segment_topics
from app.services.summarization import generate_lecture_summaries
from app.services.quiz_generation import save_draft_quizzes
from app.services.vector_search import index_lecture_chunks
from app.services.youtube import fetch_youtube_transcript

logger = logging.getLogger("lecturelens.pipeline")


async def run_lecture_processing_pipeline(
    lecture_id: str,
    media_path: Optional[str] = None,
    language_hint: Optional[str] = None,
):
    """Asynchronous background processing worker that executes:
    1. ASR Transcription (or YouTube caption extraction)
    2. Multilingual Topic Segmentation
    3. Extractive Summarization
    4. Search Chunk Generation and Vector Indexing
    5. Draft Quiz Generation
    6. Status transition to 'review_required'
    """
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    logger.info(f"Starting processing pipeline for lecture {lecture_id}")

    # Set status to processing
    await db.lectures.update_one(
        {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
        {"$set": {"status": "processing", "updated_at": now}}
    )

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

        if source_type == "upload":
            if not media_path or not os.path.exists(media_path):
                raise FileNotFoundError(f"Media file not found at: {media_path}")
            
            # Execute Faster-Whisper ASR
            asr_res = transcribe_file(media_path, language=language_hint)
            segments = asr_res.get("segments", [])
            detected_language = asr_res.get("language", "en")
            detected_prob = asr_res.get("language_probability", 1.0)
            duration = asr_res.get("duration", segments[-1]["end"] if segments else 0.0)

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

        # 6. Update lecture to review_required
        update_payload = {
            "status": "review_required",
            "language": detected_language,
            "language_probability": detected_prob,
            "duration": duration,
            "segments": segments,
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

    except Exception as e:
        logger.exception(f"Pipeline error for lecture {lecture_id}: {e}")
        await db.lectures.update_one(
            {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
            {
                "$set": {
                    "status": "failed",
                    "failure_reason": str(e),
                    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                }
            }
        )

