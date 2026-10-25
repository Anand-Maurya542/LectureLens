import datetime
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db, serialize_doc
from app.dependencies.auth import require_teacher
from app.schemas.lecture import TranscriptCorrectionRequest
from app.services.vector_search import index_lecture_chunks

logger = logging.getLogger("lecturelens.router.transcript")
router = APIRouter(prefix="/api/lectures/{lecture_id}/transcript", tags=["Transcript Review"])


@router.patch("")
async def edit_transcript_segment(
    lecture_id: str,
    payload: TranscriptCorrectionRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher to correct a transcript segment.
    Preserves audit trail and updates downstream topics and vector chunks.
    """
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lec.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to edit this lecture's transcript.")

    segments = lec.get("segments", [])
    if payload.segment_index < 0 or payload.segment_index >= len(segments):
        raise HTTPException(status_code=400, detail="Invalid segment index")

    target_seg = segments[payload.segment_index]
    previous_text = target_seg.get("text", "")
    new_text = payload.new_text.strip()

    # Update segment
    target_seg["original_text"] = target_seg.get("original_text") or previous_text
    target_seg["text"] = new_text
    target_seg["is_edited"] = True

    # Also update in topics if present
    topics = lec.get("topics", [])
    for top in topics:
        for seg in top.get("segments", []):
            if seg.get("segment_index") == payload.segment_index:
                seg["text"] = new_text
                seg["is_edited"] = True

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.lectures.update_one(
        {"_id": lec["_id"]},
        {"$set": {"segments": segments, "topics": topics, "updated_at": now}}
    )

    # Record in audit log
    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "transcript_edit",
        "entity_type": "transcript_segment",
        "entity_id": f"{lecture_id}_{payload.segment_index}",
        "diff": {
            "previous_text": previous_text,
            "new_text": new_text,
            "segment_index": payload.segment_index,
        },
        "timestamp": now,
    })

    # Asynchronously refresh vector search chunks so edits are searchable immediately
    try:
        await index_lecture_chunks(
            lecture_id=str(lecture_id),
            course_id=str(lec.get("course_id", "")),
            topics=topics,
            is_published=lec.get("is_published", False),
        )
    except Exception as e:
        logger.warning(f"Re-indexing chunks after transcript edit warning: {e}")

    return {
        "message": "Transcript segment corrected successfully",
        "segment": target_seg,
    }

