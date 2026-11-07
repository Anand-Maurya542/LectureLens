import datetime
import logging
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from app.database import get_db, serialize_doc
from app.dependencies.auth import get_current_user, require_teacher
from app.schemas.lecture import (
    TranscriptCorrectionRequest,
    TranscriptBatchCorrectionRequest,
    TranscriptApprovalRequest,
    TranscriptRejectionRequest,
)
from app.services.transcription import (
    group_segments_into_paragraphs,
    export_transcript_text,
    export_transcript_srt,
    export_transcript_vtt,
)
from app.services.vector_search import index_lecture_chunks

logger = logging.getLogger("lecturelens.router.transcript")
router = APIRouter(prefix="/api/lectures/{lecture_id}/transcript", tags=["Transcript Management"])


async def _get_authorized_lecture(lecture_id: str, current_user: dict, require_edit: bool = False) -> tuple[dict, dict]:
    """Helper to verify lecture existence, user permissions, and course enrollment status."""
    db = get_db()
    l_query = {"_id": ObjectId(lecture_id)} if ObjectId.is_valid(lecture_id) else {"_id": lecture_id}
    lec = await db.lectures.find_one(l_query)
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")

    # Fetch parent course to verify ownership and co-instructors
    course_id = str(lec.get("course_id", ""))
    c_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"_id": course_id}
    course = await db.courses.find_one(c_query) if course_id else None

    # Check if user is instructor for this lecture / course
    is_teacher = False
    if role == "admin":
        is_teacher = True
    elif role == "teacher":
        if str(lec.get("teacher_id")) == user_id:
            is_teacher = True
        elif course:
            t_ids = [str(x) for x in course.get("teacher_ids", [])]
            if str(course.get("teacher_id")) == user_id or user_id in t_ids:
                is_teacher = True

    if require_edit and not is_teacher:
        raise HTTPException(status_code=403, detail="Unauthorized to edit or manage this lecture transcript.")

    if not is_teacher and role == "student":
        # Students can view only approved and published transcripts
        is_published = lec.get("is_published", False)
        transcript_status = lec.get("transcript_status", "ai_generated")
        if not is_published and transcript_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Transcript is pending instructor review and approval.",
            )

        # Check student enrollment in the course
        if course:
            s_ids = [str(x) for x in course.get("student_ids", [])]
            if user_id not in s_ids:
                # Check course_enrollments table for approved record
                enroll = await db.course_enrollments.find_one({
                    "course_id": course_id,
                    "user_id": user_id,
                    "status": "approved",
                })
                if not enroll:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You must be an approved student in this course to access the transcript.",
                    )

    return lec, course


@router.get("")
async def get_lecture_transcript(
    lecture_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full transcript segments and intelligently grouped paragraphs for a lecture.
    Students can access only approved/published transcripts.
    Instructors and admins can view audit history, original AI text, and approval status.
    """
    lec, course = await _get_authorized_lecture(lecture_id, current_user, require_edit=False)

    segments = lec.get("segments", [])
    paragraphs = lec.get("paragraphs") or group_segments_into_paragraphs(segments)

    # Determine stats
    edited_count = sum(1 for s in segments if s.get("is_edited"))

    return {
        "lecture_id": str(lec["_id"]),
        "lecture_title": lec.get("title", ""),
        "course_id": str(lec.get("course_id", "")),
        "course_title": course.get("title", "") if course else lec.get("course_title", ""),
        "language": lec.get("language", "en"),
        "duration": lec.get("duration", 0.0),
        "transcript_status": lec.get("transcript_status", "ai_generated"),
        "is_published": lec.get("is_published", False),
        "transcript_approved_by": lec.get("transcript_approved_by"),
        "transcript_approved_at": lec.get("transcript_approved_at"),
        "transcript_rejection_reason": lec.get("transcript_rejection_reason"),
        "segments": segments,
        "paragraphs": paragraphs,
        "total_segments": len(segments),
        "total_paragraphs": len(paragraphs),
        "edited_segments_count": edited_count,
    }


@router.patch("")
async def edit_transcript_segment(
    lecture_id: str,
    payload: TranscriptCorrectionRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher to correct an individual transcript segment.
    Preserves original AI text, updates downstream paragraphs and search vector chunks,
    and logs an audit trail.
    """
    lec, course = await _get_authorized_lecture(lecture_id, teacher, require_edit=True)
    db = get_db()

    segments = lec.get("segments", [])
    if payload.segment_index < 0 or payload.segment_index >= len(segments):
        raise HTTPException(status_code=400, detail="Invalid segment index")

    target_seg = segments[payload.segment_index]
    previous_text = target_seg.get("text", "")
    new_text = (payload.new_text or payload.text or "").strip()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Never overwrite original AI-generated transcript!
    if not target_seg.get("original_text"):
        target_seg["original_text"] = previous_text

    target_seg["text"] = new_text
    target_seg["is_edited"] = True
    target_seg["corrected_by"] = str(teacher["id"])
    target_seg["corrected_at"] = now

    # Also synchronize inside topics structure if present
    topics = lec.get("topics", [])
    for top in topics:
        for seg in top.get("segments", []):
            if seg.get("segment_index") == payload.segment_index:
                if not seg.get("original_text"):
                    seg["original_text"] = seg.get("text", "")
                seg["text"] = new_text
                seg["is_edited"] = True

    # Re-generate readable paragraphs with updated sentences
    paragraphs = group_segments_into_paragraphs(segments)

    # Transition transcript status to in_review if it was still ai_generated
    new_status = lec.get("transcript_status", "ai_generated")
    if new_status == "ai_generated":
        new_status = "in_review"

    await db.lectures.update_one(
        {"_id": lec["_id"]},
        {
            "$set": {
                "segments": segments,
                "paragraphs": paragraphs,
                "topics": topics,
                "transcript_status": new_status,
                "updated_at": now,
            }
        },
    )

    # Persist in transcript_segments collection
    await db.transcript_segments.update_one(
        {"lecture_id": str(lecture_id), "segment_index": payload.segment_index},
        {
            "$set": {
                "text": new_text,
                "original_text": target_seg["original_text"],
                "is_edited": True,
                "corrected_by": str(teacher["id"]),
                "corrected_at": now,
            }
        },
    )

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "transcript_segment_edit",
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
        "paragraphs": paragraphs,
        "transcript_status": new_status,
    }


@router.post("/batch-correct")
async def batch_correct_transcript_segments(
    lecture_id: str,
    payload: TranscriptBatchCorrectionRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher to save multiple segment corrections at once."""
    lec, course = await _get_authorized_lecture(lecture_id, teacher, require_edit=True)
    db = get_db()

    segments = lec.get("segments", [])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    changes_made = 0

    topics = lec.get("topics", [])

    for item in payload.corrections:
        s_idx = item.segment_index
        if 0 <= s_idx < len(segments):
            target_seg = segments[s_idx]
            previous_text = target_seg.get("text", "")
            new_text = (item.new_text or item.text or "").strip()
            if new_text != previous_text:
                if not target_seg.get("original_text"):
                    target_seg["original_text"] = previous_text
                target_seg["text"] = new_text
                target_seg["is_edited"] = True
                target_seg["corrected_by"] = str(teacher["id"])
                target_seg["corrected_at"] = now
                changes_made += 1

                for top in topics:
                    for seg in top.get("segments", []):
                        if seg.get("segment_index") == s_idx:
                            if not seg.get("original_text"):
                                seg["original_text"] = seg.get("text", "")
                            seg["text"] = new_text
                            seg["is_edited"] = True

    if changes_made > 0:
        paragraphs = group_segments_into_paragraphs(segments)
        new_status = lec.get("transcript_status", "ai_generated")
        if new_status == "ai_generated":
            new_status = "in_review"

        await db.lectures.update_one(
            {"_id": lec["_id"]},
            {
                "$set": {
                    "segments": segments,
                    "paragraphs": paragraphs,
                    "topics": topics,
                    "transcript_status": new_status,
                    "updated_at": now,
                }
            },
        )

        await db.audit_logs.insert_one({
            "user_id": str(teacher["id"]),
            "action": "transcript_batch_edit",
            "entity_type": "transcript",
            "entity_id": str(lecture_id),
            "changes_count": changes_made,
            "timestamp": now,
        })

        try:
            await index_lecture_chunks(
                lecture_id=str(lecture_id),
                course_id=str(lec.get("course_id", "")),
                topics=topics,
                is_published=lec.get("is_published", False),
            )
        except Exception as e:
            logger.warning(f"Re-indexing chunks after batch edit: {e}")

    return {
        "message": f"Successfully updated {changes_made} transcript segment(s)",
        "changes_count": changes_made,
        "segments": segments,
        "paragraphs": group_segments_into_paragraphs(segments),
    }


@router.post("/approve")
async def approve_transcript(
    lecture_id: str,
    payload: TranscriptApprovalRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher or administrator to approve the transcript.
    Optionally publishes the lecture to enrolled students immediately.
    """
    lec, course = await _get_authorized_lecture(lecture_id, teacher, require_edit=True)
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    update_fields = {
        "transcript_status": "approved",
        "transcript_approved_by": str(teacher["id"]),
        "transcript_approved_at": now,
        "updated_at": now,
    }

    if payload.publish_to_students:
        update_fields["is_published"] = True
        update_fields["status"] = "published"

    await db.lectures.update_one({"_id": lec["_id"]}, {"$set": update_fields})

    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "transcript_approved",
        "entity_type": "lecture",
        "entity_id": str(lecture_id),
        "published": payload.publish_to_students,
        "notes": payload.notes,
        "timestamp": now,
    })

    # Re-index search chunks with publication status
    try:
        await index_lecture_chunks(
            lecture_id=str(lecture_id),
            course_id=str(lec.get("course_id", "")),
            topics=lec.get("topics", []),
            is_published=update_fields.get("is_published", lec.get("is_published", False)),
        )
    except Exception as e:
        logger.warning(f"Re-indexing chunks after approval warning: {e}")

    return {
        "message": "Transcript approved and published to enrolled students"
        if payload.publish_to_students
        else "Transcript approved successfully",
        "transcript_status": "approved",
        "is_published": update_fields.get("is_published", lec.get("is_published", False)),
    }


@router.post("/reject")
async def reject_transcript(
    lecture_id: str,
    payload: TranscriptRejectionRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher or administrator to flag the transcript as requiring revision."""
    lec, course = await _get_authorized_lecture(lecture_id, teacher, require_edit=True)
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    await db.lectures.update_one(
        {"_id": lec["_id"]},
        {
            "$set": {
                "transcript_status": "rejected",
                "transcript_rejection_reason": payload.rejection_reason,
                "updated_at": now,
            }
        },
    )

    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "transcript_rejected",
        "entity_type": "lecture",
        "entity_id": str(lecture_id),
        "rejection_reason": payload.rejection_reason,
        "timestamp": now,
    })

    return {
        "message": "Transcript marked as rejected for revision",
        "transcript_status": "rejected",
        "rejection_reason": payload.rejection_reason,
    }


@router.get("/export")
async def export_transcript(
    lecture_id: str,
    format: str = Query("txt", pattern="^(txt|srt|vtt|json)$"),
    current_user: dict = Depends(get_current_user),
):
    """Exports the transcript in readable Text (.txt), SubRip Subtitle (.srt),
    WebVTT (.vtt), or structured JSON (.json) format.
    """
    lec, course = await _get_authorized_lecture(lecture_id, current_user, require_edit=False)

    segments = lec.get("segments", [])
    paragraphs = lec.get("paragraphs") or group_segments_into_paragraphs(segments)
    title = lec.get("title", f"Lecture_{lecture_id}")
    safe_filename = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip().replace(" ", "_")

    if format == "srt":
        content = export_transcript_srt(segments)
        return Response(
            content=content,
            media_type="application/x-subrip",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}.srt"'},
        )
    elif format == "vtt":
        content = export_transcript_vtt(segments)
        return Response(
            content=content,
            media_type="text/vtt",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}.vtt"'},
        )
    elif format == "json":
        data = {
            "lecture_id": str(lec["_id"]),
            "title": title,
            "course_title": course.get("title", "") if course else lec.get("course_title", ""),
            "duration": lec.get("duration", 0.0),
            "language": lec.get("language", "en"),
            "transcript_status": lec.get("transcript_status", "ai_generated"),
            "segments": segments,
            "paragraphs": paragraphs,
        }
        return data
    else:  # txt
        content = export_transcript_text(segments, paragraphs=paragraphs, title=title)
        return Response(
            content=content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}.txt"'},
        )
