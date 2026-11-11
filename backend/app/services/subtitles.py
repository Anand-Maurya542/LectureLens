import datetime
import logging
import re
from typing import Optional
from bson import ObjectId
from app.database import get_db, serialize_doc
from app.services.transcription import group_segments_into_paragraphs
from app.services.segmentation import segment_topics
from app.services.summarization import generate_lecture_summaries
from app.services.quiz_generation import save_draft_quizzes
from app.services.vector_search import index_lecture_chunks

logger = logging.getLogger("lecturelens.subtitles")


def parse_subtitles(content: str, default_duration: float = 600.0) -> list[dict]:
    """Parses SRT, WebVTT, timestamped text ([01:23] or (01:23)), or plain text
    into normalized transcript segments.
    """
    if not content or not content.strip():
        return []

    # Normalize line endings
    text = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    segments = []

    # 1. Check for standard SRT/VTT timestamp pattern: 00:01:23,456 --> 00:01:25,789
    time_pattern = re.compile(
        r"(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})"
    )

    blocks = re.split(r"\n\s*\n", text)
    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        time_match = None
        time_idx = -1
        for idx, line in enumerate(lines):
            m = time_pattern.search(line)
            if m:
                time_match = m
                time_idx = idx
                break
        if time_match:
            def to_sec(h, m, s, ms):
                hrs = int(h) if h else 0
                return hrs * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

            g = time_match.groups()
            start = round(to_sec(g[0], g[1], g[2], g[3]), 2)
            end = round(to_sec(g[4], g[5], g[6], g[7]), 2)
            body = " ".join(lines[time_idx + 1:])
            # Strip XML/HTML tags
            body = re.sub(r"<[^>]+>", "", body).strip()
            if body:
                segments.append({
                    "segment_index": len(segments),
                    "start": start,
                    "end": max(end, round(start + 0.5, 2)),
                    "text": body,
                    "avg_logprob": 0.0,
                    "no_speech_prob": 0.0,
                    "compression_ratio": 1.0,
                    "is_edited": False,
                    "original_text": body,
                })

    # 2. Check for bracketed timestamps like [01:23] Text or (01:23) Text
    if not segments:
        bracket_pattern = re.compile(r"^\[?\(?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\)?\s*(.+)$")
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = bracket_pattern.match(line)
            if m:
                h_val, m_val, s_val, txt = m.group(1), m.group(2), m.group(3), m.group(4)
                if s_val is not None:
                    sec = int(h_val) * 3600 + int(m_val) * 60 + int(s_val)
                else:
                    sec = int(h_val) * 60 + int(m_val)
                segments.append({
                    "segment_index": len(segments),
                    "start": float(sec),
                    "end": float(sec + 5.0),
                    "text": txt.strip(),
                    "avg_logprob": 0.0,
                    "no_speech_prob": 0.0,
                    "compression_ratio": 1.0,
                    "is_edited": False,
                    "original_text": txt.strip(),
                })
        # Adjust end times to match next start time
        for i in range(len(segments) - 1):
            segments[i]["end"] = min(segments[i + 1]["start"], segments[i]["start"] + 30.0)
            if segments[i]["end"] <= segments[i]["start"]:
                segments[i]["end"] = segments[i]["start"] + 3.0

    # 3. Fallback: plain text sentences
    if not segments:
        raw_sentences = [s.strip() for s in re.split(r"(?<=[.?!।॥\n])\s+", text) if len(s.strip()) > 3]
        if not raw_sentences:
            raw_sentences = [l.strip() for l in text.split("\n") if len(l.strip()) > 3]
        total = len(raw_sentences)
        step = max(3.0, default_duration / max(total, 1))
        for idx, sent in enumerate(raw_sentences):
            start = round(idx * step, 2)
            end = round((idx + 1) * step, 2)
            segments.append({
                "segment_index": idx,
                "start": start,
                "end": end,
                "text": sent,
                "avg_logprob": 0.0,
                "no_speech_prob": 0.0,
                "compression_ratio": 1.0,
                "is_edited": False,
                "original_text": sent,
            })

    return segments


async def apply_subtitles_to_lecture(lecture_id: str, segments: list[dict]) -> dict:
    """Applies parsed subtitle segments to a lecture and executes downstream pipeline stages:
    topic segmentation, extractive summaries, vector indexing, and draft quiz generation.
    Transitions status to 'review_required' and clears failure reason.
    """
    db = get_db()
    lec_query = {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id}
    lec = await db.lectures.find_one(lec_query)
    if not lec:
        raise ValueError("Lecture not found")

    course_id = lec.get("course_id", "")
    duration = segments[-1]["end"] if segments else lec.get("duration", 0.0)

    # 1. Clean and persist segments
    for idx, seg in enumerate(segments):
        seg["segment_index"] = idx
        seg["lecture_id"] = str(lecture_id)
        if not seg.get("original_text"):
            seg["original_text"] = seg.get("text", "")
        seg["is_edited"] = seg.get("is_edited", False)

    # 2. Form paragraphs
    paragraphs = group_segments_into_paragraphs(segments)

    # 3. Store transcript segments in dedicated collection
    await db.transcript_segments.delete_many({"lecture_id": str(lecture_id)})
    if segments:
        await db.transcript_segments.insert_many(segments)

    # 4. Semantic Topic Segmentation
    topics = segment_topics(segments)
    await db.topics.delete_many({"lecture_id": str(lecture_id)})
    for t in topics:
        t["lecture_id"] = str(lecture_id)
    if topics:
        await db.topics.insert_many(topics)

    # 5. Extractive Summarization
    summaries = generate_lecture_summaries(topics)
    await db.summaries.delete_many({"lecture_id": str(lecture_id)})
    for s in summaries:
        s["lecture_id"] = str(lecture_id)
    if summaries:
        await db.summaries.insert_many(summaries)

    # 6. Index Vector Chunks
    await index_lecture_chunks(str(lecture_id), str(course_id), topics, is_published=False)

    # 7. Generate Draft Quizzes
    await save_draft_quizzes(str(lecture_id), topics)

    # 8. Update Lecture status
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_data = {
        "status": "review_required",
        "failure_reason": None,
        "segments": segments,
        "paragraphs": paragraphs,
        "topics": topics,
        "summaries": summaries,
        "duration": duration,
        "updated_at": now,
    }
    await db.lectures.update_one(lec_query, {"$set": update_data})
    
    updated_lec = await db.lectures.find_one(lec_query)
    return serialize_doc(updated_lec)
