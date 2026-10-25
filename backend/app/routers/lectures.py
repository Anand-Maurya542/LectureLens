import datetime
import logging
import os
from pathlib import Path
from typing import Optional
from bson import ObjectId
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from app.config import settings
from app.database import get_db, serialize_doc, serialize_list
from app.dependencies.auth import get_current_user, require_teacher
from app.schemas.lecture import LectureCreate, LectureOut, PublicationUpdateRequest
from app.services.pipeline import run_lecture_processing_pipeline
from app.services.youtube import extract_youtube_video_id, get_youtube_embed_url

logger = logging.getLogger("lecturelens.router.lectures")
router = APIRouter(prefix="/api/lectures", tags=["Lectures"])

ALLOWED_AUDIO_VIDEO_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm", ".ogg", ".flac"
}


@router.get("", response_model=list[LectureOut])
async def list_lectures(
    course_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    role = current_user.get("role")
    user_id = str(current_user["id"])

    query = {}
    if course_id:
        query["course_id"] = str(course_id)

    if role == "student":
        # Students ONLY see published lectures in courses they are enrolled in
        enrolled_courses = await db.courses.find({"student_ids": user_id}).to_list(100)
        enrolled_ids = [str(c["_id"]) for c in enrolled_courses]
        
        if course_id and course_id not in enrolled_ids:
            return []
        
        query["course_id"] = {"$in": enrolled_ids}
        query["is_published"] = True
    elif role == "teacher":
        # Teachers see their lectures or course lectures
        teacher_courses = await db.courses.find({"teacher_id": user_id}).to_list(100)
        c_ids = [str(c["_id"]) for c in teacher_courses]
        if course_id:
            query["course_id"] = str(course_id)
        else:
            query["course_id"] = {"$in": c_ids}

    cursor = db.lectures.find(query).sort("created_at", -1)
    lectures = await cursor.to_list(length=100)

    # Hydrate course and teacher titles
    result = []
    for lec in lectures:
        cid = lec.get("course_id")
        c = await db.courses.find_one({"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid})
        lec_dict = serialize_doc(lec)
        lec_dict["course_title"] = c.get("title") if c else "Unknown Course"
        result.append(lec_dict)

    return result


@router.get("/{lecture_id}", response_model=LectureOut)
async def get_lecture(
    lecture_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    lec = None
    try:
        lec = await db.lectures.find_one({"_id": ObjectId(lecture_id)})
    except Exception:
        pass
    if not lec:
        lec = await db.lectures.find_one({"_id": lecture_id})

    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    role = current_user.get("role")
    user_id = str(current_user["id"])

    # Strict RBAC: Student must be enrolled in course and lecture must be published
    if role == "student":
        if not lec.get("is_published", False):
            raise HTTPException(
                status_code=403,
                detail="This lecture has not been published by the instructor yet.",
            )
        course = await db.courses.find_one({"_id": ObjectId(lec["course_id"]) if ObjectId.is_valid(lec["course_id"]) else lec["course_id"]})
        if not course or user_id not in course.get("student_ids", []):
            raise HTTPException(
                status_code=403,
                detail="You are not enrolled in the course for this lecture.",
            )

    c = await db.courses.find_one({"_id": ObjectId(lec.get("course_id")) if ObjectId.is_valid(lec.get("course_id")) else lec.get("course_id")})
    lec_dict = serialize_doc(lec)
    lec_dict["course_title"] = c.get("title") if c else "Unknown Course"
    return lec_dict


@router.post("/upload", response_model=LectureOut)
async def upload_lecture(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    course_id: str = Form(...),
    description: Optional[str] = Form(""),
    language_hint: Optional[str] = Form(None),
    file: UploadFile = File(...),
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    # Verify course ownership
    course = await db.courses.find_one({"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to add lectures to this course.")

    filename = file.filename or "lecture_recording"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO_VIDEO_EXTENSIONS))}",
        )

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_lec = {
        "title": title.strip(),
        "description": description or "",
        "course_id": str(course_id),
        "teacher_id": str(teacher["id"]),
        "source_type": "upload",
        "status": "queued",
        "is_published": False,
        "segments": [],
        "topics": [],
        "summaries": [],
        "created_at": now,
        "updated_at": now,
    }

    insert_res = await db.lectures.insert_one(new_lec)
    lecture_id = str(insert_res.inserted_id)

    # Save media file safely to storage directory
    save_filename = f"{lecture_id}_{Path(filename).name}"
    dest_path = settings.MEDIA_UPLOAD_DIR / save_filename

    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    finally:
        await file.close()

    # Update media path in DB
    await db.lectures.update_one(
        {"_id": ObjectId(lecture_id)},
        {"$set": {"media_url": f"/api/media/{save_filename}", "storage_path": str(dest_path)}}
    )

    # Queue background AI processing
    background_tasks.add_task(
        run_lecture_processing_pipeline,
        lecture_id=lecture_id,
        media_path=str(dest_path),
        language_hint=language_hint,
    )

    new_lec["_id"] = lecture_id
    new_lec["id"] = lecture_id
    new_lec["media_url"] = f"/api/media/{save_filename}"
    new_lec["course_title"] = course.get("title")

    return serialize_doc(new_lec)


@router.post("/youtube", response_model=LectureOut)
async def create_youtube_lecture(
    payload: LectureCreate,
    background_tasks: BackgroundTasks,
    teacher: dict = Depends(require_teacher),
):
    if not payload.youtube_url:
        raise HTTPException(status_code=400, detail="YouTube URL is required")

    video_id = extract_youtube_video_id(payload.youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Could not extract video ID.")

    db = get_db()
    course = await db.courses.find_one({"_id": ObjectId(payload.course_id) if ObjectId.is_valid(payload.course_id) else payload.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized for this course.")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_lec = {
        "title": payload.title.strip(),
        "description": payload.description or "",
        "course_id": str(payload.course_id),
        "teacher_id": str(teacher["id"]),
        "source_type": "youtube",
        "youtube_url": payload.youtube_url.strip(),
        "youtube_video_id": video_id,
        "media_url": get_youtube_embed_url(video_id),
        "status": "queued",
        "is_published": False,
        "segments": [],
        "topics": [],
        "summaries": [],
        "created_at": now,
        "updated_at": now,
    }

    res = await db.lectures.insert_one(new_lec)
    lecture_id = str(res.inserted_id)

    # Queue background caption fetching and pipeline
    background_tasks.add_task(
        run_lecture_processing_pipeline,
        lecture_id=lecture_id,
    )

    new_lec["_id"] = lecture_id
    new_lec["id"] = lecture_id
    new_lec["course_title"] = course.get("title")

    return serialize_doc(new_lec)


@router.patch("/{lecture_id}/publish", response_model=LectureOut)
async def update_publication_status(
    lecture_id: str,
    payload: PublicationUpdateRequest,
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lec.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to publish this lecture.")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.lectures.update_one(
        {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id},
        {"$set": {"is_published": payload.is_published, "updated_at": now}}
    )

    # Synchronize publication flag on lecture chunks for vector search filtering
    await db.lecture_chunks.update_many(
        {"lecture_id": str(lecture_id)},
        {"$set": {"is_published": payload.is_published}}
    )

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "content_publish" if payload.is_published else "content_unpublish",
        "entity_type": "lecture",
        "entity_id": str(lecture_id),
        "diff": {"is_published": payload.is_published},
        "timestamp": now,
    })

    lec["is_published"] = payload.is_published
    return serialize_doc(lec)


@router.post("/{lecture_id}/retry", response_model=LectureOut)
async def retry_lecture_processing(
    lecture_id: str,
    background_tasks: BackgroundTasks,
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    storage_path = lec.get("storage_path")
    background_tasks.add_task(
        run_lecture_processing_pipeline,
        lecture_id=str(lecture_id),
        media_path=storage_path,
    )

    lec["status"] = "processing"
    return serialize_doc(lec)


@router.delete("/{lecture_id}")
async def delete_lecture(
    lecture_id: str,
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lec.get("teacher_id") != str(teacher["id"]) and teacher.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized to delete this lecture.")

    # Clean up associated collections
    await db.lectures.delete_one({"_id": lec["_id"]})
    await db.transcript_segments.delete_many({"lecture_id": str(lecture_id)})
    await db.topics.delete_many({"lecture_id": str(lecture_id)})
    await db.summaries.delete_many({"lecture_id": str(lecture_id)})
    await db.lecture_chunks.delete_many({"lecture_id": str(lecture_id)})
    await db.quizzes.delete_many({"lecture_id": str(lecture_id)})
    await db.quiz_attempts.delete_many({"lecture_id": str(lecture_id)})

    # Delete local file if present
    storage_path = lec.get("storage_path")
    if storage_path and os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except Exception:
            pass

    return {"message": "Lecture and all associated data deleted successfully"}

