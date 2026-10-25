import datetime
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db, serialize_doc
from app.dependencies.auth import require_teacher
from app.schemas.lecture import TopicCorrectionRequest
from app.services.vector_search import index_lecture_chunks

logger = logging.getLogger("lecturelens.router.topics")
router = APIRouter(prefix="/api/lectures/{lecture_id}/topics", tags=["Topics Review"])


@router.patch("/{topic_index}")
async def edit_topic(
    lecture_id: str,
    topic_index: int,
    payload: TopicCorrectionRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher to correct topic title and timestamps."""
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lec.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to edit topics.")

    topics = lec.get("topics", [])
    target_topic = None
    for top in topics:
        if top.get("topic_id") == topic_index:
            target_topic = top
            break

    if not target_topic:
        raise HTTPException(status_code=404, detail=f"Topic index {topic_index} not found")

    old_title = target_topic.get("title")
    target_topic["title"] = payload.new_title.strip()
    if payload.start is not None:
        target_topic["start"] = payload.start
    if payload.end is not None:
        target_topic["end"] = payload.end
    target_topic["is_edited"] = True

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.lectures.update_one(
        {"_id": lec["_id"]},
        {"$set": {"topics": topics, "updated_at": now}}
    )

    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "topic_edit",
        "entity_type": "topic",
        "entity_id": f"{lecture_id}_{topic_index}",
        "diff": {
            "old_title": old_title,
            "new_title": payload.new_title,
        },
        "timestamp": now,
    })

    # Update lecture chunks with new topic title
    try:
        await index_lecture_chunks(
            lecture_id=str(lecture_id),
            course_id=str(lec.get("course_id", "")),
            topics=topics,
            is_published=lec.get("is_published", False),
        )
    except Exception as e:
        logger.warning(f"Re-indexing chunks error: {e}")

    return {
        "message": "Topic updated successfully",
        "topic": target_topic,
    }

