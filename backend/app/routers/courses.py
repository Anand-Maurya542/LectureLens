import datetime
import logging
import random
import string
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.database import get_db, serialize_doc, serialize_list
from app.dependencies.auth import get_current_user, require_admin, require_teacher
from app.schemas.course import (
    CourseCreate,
    CourseEnroll,
    CourseEnrollmentOut,
    CourseEnrollmentRequest,
    CourseGlossaryUpdate,
    CourseOut,
    CourseUpdate,
)

logger = logging.getLogger("lecturelens.router.courses")
router = APIRouter(prefix="/api/courses", tags=["Courses"])


def generate_course_code() -> str:
    """Generates a random 6-character uppercase alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))


@router.get("", response_model=list[CourseOut])
async def list_courses(
    catalog: bool = Query(False, description="Whether to browse the course catalog of all active courses"),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
):
    """Lists courses.
    - If catalog=True: returns all active courses with the user's enrollment status (approved, pending, rejected, or none).
    - If catalog=False:
        - Admin sees all courses.
        - Teacher sees only courses where they are primary instructor or approved co-instructor.
        - Student sees only courses where their enrollment has been approved.
    """
    db = get_db()
    role = current_user.get("role")
    user_id = str(current_user["id"])

    oid = ObjectId(user_id) if ObjectId.is_valid(user_id) else None
    user_match = [user_id]
    if oid:
        user_match.append(oid)

    if catalog:
        # Course catalog: browse active courses available for enrollment (including legacy courses where status is active, missing, or null)
        active_condition = {"$or": [{"status": "active"}, {"status": {"$exists": False}}, {"status": None}]}
        if status_filter and status_filter != "all":
            if status_filter == "active":
                query = active_condition
            else:
                query = {"status": status_filter}
        else:
            query = active_condition
    else:
        if role == "admin":
            query = {}
            if status_filter and status_filter != "all":
                query["status"] = status_filter
        elif role == "teacher":
            # Approved courses only
            query = {
                "$or": [
                    {"teacher_id": {"$in": user_match}},
                    {"teacher_ids": {"$in": user_match}},
                ]
            }
        else:
            # Student approved courses only
            query = {"student_ids": {"$in": user_match}}

    cursor = db.courses.find(query).sort("created_at", -1)
    courses = await cursor.to_list(length=200)

    # Fetch user's pending/rejected enrollments to annotate catalog
    user_enrollments_map = {}
    if catalog or role in ["student", "teacher"]:
        user_reqs = await db.course_enrollments.find({"user_id": user_id}).to_list(200)
        for req in user_reqs:
            user_enrollments_map[str(req.get("course_id"))] = req.get("status")

    result = []
    for c in courses:
        cid = str(c.get("_id", c.get("id", "")))
        lec_count = await db.lectures.count_documents({"course_id": cid})
        raw_s_ids = c.get("student_ids") or []
        s_ids = [str(x) for x in raw_s_ids if x]
        raw_t_ids = c.get("teacher_ids") or ([c.get("teacher_id")] if c.get("teacher_id") else [])
        t_ids = [str(x) for x in raw_t_ids if x]
        student_count = len(s_ids)
        pending_count = await db.course_enrollments.count_documents(
            {"course_id": cid, "status": "pending"}
        )

        # Hydrate primary teacher name
        t_user = None
        tid = c.get("teacher_id")
        if tid:
            try:
                t_user = await db.users.find_one({"_id": ObjectId(tid) if ObjectId.is_valid(tid) else tid})
            except Exception:
                pass
        teacher_name = t_user.get("name") if t_user else "Instructor"

        # Determine user's enrollment status in this course
        enrollment_status = None
        if role == "teacher":
            if user_id == str(c.get("teacher_id")) or user_id in t_ids:
                enrollment_status = "approved"
            elif cid in user_enrollments_map:
                enrollment_status = user_enrollments_map[cid]
        elif role == "student":
            if user_id in s_ids:
                enrollment_status = "approved"
            elif cid in user_enrollments_map:
                enrollment_status = user_enrollments_map[cid]
        elif role == "admin":
            enrollment_status = "approved"

        c_serialized = serialize_doc(c) or {}
        c_serialized["lecture_count"] = lec_count
        c_serialized["student_count"] = student_count
        c_serialized["pending_requests_count"] = pending_count
        c_serialized["teacher_name"] = teacher_name
        c_serialized["teacher_ids"] = t_ids
        c_serialized["student_ids"] = s_ids
        c_serialized["status"] = c.get("status", "active")
        c_serialized["code"] = c.get("code", "")
        c_serialized["title"] = c.get("title", "Untitled Course")
        c_serialized["user_enrollment_status"] = enrollment_status
        result.append(c_serialized)

    return result


@router.post("", response_model=CourseOut)
async def create_course(
    payload: CourseCreate,
    current_user: dict = Depends(get_current_user),
):
    """Allows an Admin or Teacher to create a new course."""
    db = get_db()
    role = current_user.get("role")
    if role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers and administrators can create courses.",
        )

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_code = payload.code.upper().strip() if payload.code else generate_course_code()

    # Ensure unique course code
    existing = await db.courses.find_one({"code": raw_code})
    if existing:
        if payload.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course code '{raw_code}' is already in use. Please choose a unique code.",
            )
        raw_code = generate_course_code()

    primary_teacher_id = payload.teacher_id if (role == "admin" and payload.teacher_id) else str(current_user["id"])

    new_course = {
        "title": payload.title.strip(),
        "description": payload.description or "",
        "code": raw_code,
        "thumbnail_url": payload.thumbnail_url or "",
        "status": payload.status or "active",
        "glossary": [str(t).strip() for t in payload.glossary if str(t).strip()] if payload.glossary else [],
        "teacher_id": primary_teacher_id,
        "teacher_ids": [primary_teacher_id],
        "student_ids": [],
        "created_at": now,
        "updated_at": now,
    }

    insert_res = await db.courses.insert_one(new_course)
    course_id = str(insert_res.inserted_id)

    # Automatically create an approved enrollment record for the creator
    await db.course_enrollments.insert_one({
        "course_id": course_id,
        "course_title": new_course["title"],
        "course_code": new_course["code"],
        "user_id": primary_teacher_id,
        "user_name": current_user.get("name", "Instructor"),
        "user_email": current_user.get("email", ""),
        "user_role": "teacher",
        "status": "approved",
        "created_at": now,
        "reviewed_by": str(current_user["id"]),
        "reviewed_at": now,
    })

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": str(current_user["id"]),
        "action": "course_created",
        "entity_type": "course",
        "entity_id": course_id,
        "course_code": raw_code,
        "timestamp": now,
    })

    new_course["id"] = course_id
    new_course["teacher_name"] = current_user.get("name")
    new_course["student_count"] = 0
    new_course["lecture_count"] = 0
    new_course["pending_requests_count"] = 0
    new_course["user_enrollment_status"] = "approved"

    return serialize_doc(new_course)


@router.get("/{course_id}", response_model=CourseOut)
async def get_course_detail(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves full details for a course with RBAC checks."""
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")
    cid = str(course["_id"])

    # Determine enrollment status
    enrollment_status = None
    raw_s_ids = course.get("student_ids") or []
    s_ids = [str(x) for x in raw_s_ids if x]
    raw_t_ids = course.get("teacher_ids") or ([course.get("teacher_id")] if course.get("teacher_id") else [])
    t_ids = [str(x) for x in raw_t_ids if x]

    if role == "teacher":
        if user_id == str(course.get("teacher_id")) or user_id in t_ids:
            enrollment_status = "approved"
    elif role == "student":
        if user_id in s_ids:
            enrollment_status = "approved"
    elif role == "admin":
        enrollment_status = "approved"

    if not enrollment_status:
        req = await db.course_enrollments.find_one({"course_id": cid, "user_id": user_id})
        if req:
            enrollment_status = req.get("status")

    lec_count = await db.lectures.count_documents({"course_id": cid})
    t_user = None
    try:
        t_user = await db.users.find_one(
            {"_id": ObjectId(course["teacher_id"]) if ObjectId.is_valid(course.get("teacher_id", "")) else course.get("teacher_id")}
        )
    except Exception:
        pass

    course_data = serialize_doc(course) or {}
    course_data["lecture_count"] = lec_count
    course_data["student_count"] = len(s_ids)
    course_data["teacher_name"] = t_user.get("name") if t_user else "Instructor"
    course_data["teacher_ids"] = t_ids
    course_data["student_ids"] = s_ids
    course_data["status"] = course.get("status", "active")
    course_data["code"] = course.get("code", "")
    course_data["title"] = course.get("title", "Untitled Course")
    course_data["user_enrollment_status"] = enrollment_status

    return course_data


@router.patch("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: str,
    payload: CourseUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Allows an Admin or Course Owner to edit course details, status, and code."""
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")
    is_owner = (str(course.get("teacher_id")) == user_id) or (user_id in [str(x) for x in course.get("teacher_ids", [])])

    if role != "admin" and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to edit this course.",
        )

    updates = {}
    if payload.title is not None and payload.title.strip():
        updates["title"] = payload.title.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.thumbnail_url is not None:
        updates["thumbnail_url"] = payload.thumbnail_url.strip()
    if payload.status is not None:
        if payload.status not in ["active", "inactive"]:
            raise HTTPException(status_code=400, detail="Status must be 'active' or 'inactive'.")
        updates["status"] = payload.status
    if payload.glossary is not None:
        updates["glossary"] = [str(t).strip() for t in payload.glossary if str(t).strip()]
    if payload.code is not None and payload.code.strip():
        new_code = payload.code.strip().upper()
        if new_code != course.get("code"):
            existing = await db.courses.find_one({"code": new_code})
            if existing:
                raise HTTPException(status_code=400, detail=f"Course code '{new_code}' is already taken.")
            updates["code"] = new_code

    if not updates:
        return serialize_doc(course)

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    updates["updated_at"] = now

    await db.courses.update_one({"_id": course["_id"]}, {"$set": updates})

    # If title or code updated, sync denormalized fields in enrollments
    sync_fields = {}
    if "title" in updates:
        sync_fields["course_title"] = updates["title"]
    if "code" in updates:
        sync_fields["course_code"] = updates["code"]
    if sync_fields:
        await db.course_enrollments.update_many(
            {"course_id": str(course["_id"])},
            {"$set": sync_fields}
        )

    updated_course = await db.courses.find_one({"_id": course["_id"]})
    return serialize_doc(updated_course)


@router.get("/{course_id}/glossary")
async def get_course_glossary(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves technical vocabulary / glossaries configured for a course."""
    db = get_db()
    c_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"_id": course_id}
    course = await db.courses.find_one(c_query)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return {
        "course_id": str(course["_id"]),
        "course_code": course.get("code", ""),
        "course_title": course.get("title", ""),
        "glossary": course.get("glossary", []),
    }


@router.put("/{course_id}/glossary")
async def update_course_glossary(
    course_id: str,
    payload: CourseGlossaryUpdate,
    current_user: dict = Depends(require_teacher),
):
    """Allows authorized course teachers and admins to configure technical vocabulary/glossary."""
    db = get_db()
    c_query = {"_id": ObjectId(course_id)} if ObjectId.is_valid(course_id) else {"_id": course_id}
    course = await db.courses.find_one(c_query)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")
    teacher_ids = [str(x) for x in course.get("teacher_ids", [])]
    if str(course.get("teacher_id")):
        teacher_ids.append(str(course.get("teacher_id")))

    if role != "admin" and user_id not in teacher_ids:
        raise HTTPException(status_code=403, detail="Unauthorized to manage vocabulary for this course.")

    cleaned_terms = sorted(list({str(t).strip() for t in payload.glossary if str(t).strip()}))
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.courses.update_one(c_query, {"$set": {"glossary": cleaned_terms, "updated_at": now}})

    return {
        "message": f"Course glossary updated ({len(cleaned_terms)} technical terms)",
        "course_id": str(course["_id"]),
        "glossary": cleaned_terms,
        "count": len(cleaned_terms),
    }


@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    force: bool = Query(False, description="Force delete and cascade remove associated lectures"),
    current_user: dict = Depends(get_current_user),
):
    """Deletes a course with dependency checks."""
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")
    is_owner = (str(course.get("teacher_id")) == user_id)

    if role != "admin" and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this course.",
        )

    cid = str(course["_id"])
    lecture_count = await db.lectures.count_documents({"course_id": cid})

    if lecture_count > 0 and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course contains {lecture_count} lecture(s). Use force=true to cascade delete.",
        )

    # Cascade delete lectures and enrollments
    if lecture_count > 0:
        await db.lectures.delete_many({"course_id": cid})
        await db.lecture_chunks.delete_many({"course_id": cid})
    await db.course_enrollments.delete_many({"course_id": cid})
    await db.courses.delete_one({"_id": course["_id"]})

    # Audit log
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": "course_deleted",
        "entity_type": "course",
        "entity_id": cid,
        "title": course.get("title"),
        "timestamp": now,
    })

    return {"success": True, "message": f"Course '{course.get('title')}' deleted successfully."}


@router.post("/{course_id}/enroll", response_model=CourseEnrollmentOut)
async def request_course_enrollment(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Submits a course enrollment request with status 'pending' awaiting Admin approval.
    - Only active courses accept new enrollment requests.
    - Prevents duplicate requests.
    """
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    if course.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course is currently inactive and not accepting enrollment requests.",
        )

    user_id = str(current_user["id"])
    role = current_user.get("role")
    cid = str(course["_id"])

    # Check if already an approved member
    raw_s_ids = course.get("student_ids") or []
    s_ids = [str(x) for x in raw_s_ids if x]
    raw_t_ids = course.get("teacher_ids") or ([course.get("teacher_id")] if course.get("teacher_id") else [])
    t_ids = [str(x) for x in raw_t_ids if x]

    if role == "student" and user_id in s_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already an approved student in this course.",
        )
    if role == "teacher" and (user_id == str(course.get("teacher_id")) or user_id in t_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already an approved instructor for this course.",
        )

    # Check existing enrollment record
    existing_enrollment = await db.course_enrollments.find_one(
        {"course_id": cid, "user_id": user_id}
    )
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if existing_enrollment:
        if existing_enrollment.get("status") == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your enrollment request is already submitted and awaiting administrative approval.",
            )
        if existing_enrollment.get("status") == "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an approved enrollment in this course.",
            )
        # If rejected, allow re-applying by updating to pending
        await db.course_enrollments.update_one(
            {"_id": existing_enrollment["_id"]},
            {
                "$set": {
                    "status": "pending",
                    "rejection_reason": None,
                    "created_at": now,
                    "updated_at": now,
                }
            },
        )
        updated = await db.course_enrollments.find_one({"_id": existing_enrollment["_id"]})
        return serialize_doc(updated)

    # Create new enrollment request
    new_request = {
        "course_id": cid,
        "course_title": course.get("title"),
        "course_code": course.get("code"),
        "user_id": user_id,
        "user_name": current_user.get("name"),
        "user_email": current_user.get("email"),
        "user_role": role,
        "status": "pending",
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
    }

    insert_res = await db.course_enrollments.insert_one(new_request)
    new_request["_id"] = str(insert_res.inserted_id)
    new_request["id"] = str(insert_res.inserted_id)

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": "course_enrollment_requested",
        "entity_type": "course_enrollment",
        "entity_id": new_request["id"],
        "course_id": cid,
        "role": role,
        "timestamp": now,
    })

    return serialize_doc(new_request)


@router.post("/enroll", response_model=CourseOut)
async def enroll_in_course_by_code(
    payload: CourseEnroll,
    student: dict = Depends(get_current_user),
):
    """Enrolls in a course via unique course code by creating a pending enrollment request for Admin approval."""
    import re
    db = get_db()

    raw_code = payload.code.strip()
    code_upper = raw_code.upper()
    code_no_spaces = re.sub(r"\s+", "", code_upper)
    flexible_regex = "^" + r"\s*".join([re.escape(c) for c in code_no_spaces]) + "$"

    # Case-insensitive and whitespace-tolerant course code search
    course = await db.courses.find_one({
        "$or": [
            {"code": code_upper},
            {"code": code_no_spaces},
            {"code": {"$regex": flexible_regex, "$options": "i"}},
            {"code": {"$regex": f"^{re.escape(code_no_spaces)}$", "$options": "i"}},
            {"code": {"$regex": f"^{re.escape(raw_code)}$", "$options": "i"}},
        ]
    })
    if not course:
        raise HTTPException(
            status_code=404,
            detail=f"Course with code '{raw_code}' was not found. Please verify the code and try again.",
        )

    # Check course active status
    if course.get("status", "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Course '{course.get('code', raw_code)}' is currently inactive and not accepting enrollment requests.",
        )

    student_id = str(student["id"])
    cid = str(course["_id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Check if student is already an approved member
    raw_s_ids = course.get("student_ids") or []
    s_ids = [str(x) for x in raw_s_ids if x]
    if student_id in s_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already an approved enrolled student in '{course.get('title')}'.",
        )

    # Check for existing enrollment request in course_enrollments
    existing_enrollment = await db.course_enrollments.find_one(
        {"course_id": cid, "user_id": student_id}
    )

    if existing_enrollment:
        curr_status = existing_enrollment.get("status")
        if curr_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your enrollment request for '{course.get('title')}' is already pending administrator approval.",
            )
        elif curr_status == "approved":
            # Sync to student_ids
            await db.courses.update_one(
                {"_id": course["_id"]},
                {"$addToSet": {"student_ids": student_id}}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You are already an approved member of '{course.get('title')}'.",
            )
        else:
            # Reopen previously rejected enrollment request
            await db.course_enrollments.update_one(
                {"_id": existing_enrollment["_id"]},
                {
                    "$set": {
                        "status": "pending",
                        "rejection_reason": None,
                        "updated_at": now,
                    }
                },
            )
    else:
        new_enrollment = {
            "course_id": cid,
            "course_title": course.get("title", "Untitled Course"),
            "course_code": course.get("code", code_upper),
            "user_id": student_id,
            "user_name": student.get("name", "Student"),
            "user_email": student.get("email", ""),
            "user_role": "student",
            "status": "pending",
            "created_at": now,
        }
        await db.course_enrollments.insert_one(new_enrollment)

    # Log audit event
    await db.audit_logs.insert_one({
        "user_id": student_id,
        "action": "course_enrollment_requested_by_code",
        "entity_type": "course_enrollment",
        "entity_id": cid,
        "course_code": course.get("code"),
        "timestamp": now,
    })

    # Prepare response data matching CourseOut with user_enrollment_status set to pending
    course_data = serialize_doc(course) or {}
    course_data["student_count"] = len(s_ids)
    course_data["user_enrollment_status"] = "pending"
    course_data["status"] = course.get("status", "active")
    course_data["code"] = course.get("code", "")
    course_data["title"] = course.get("title", "Untitled Course")
    return course_data


@router.get("/my/enrollments", response_model=list[CourseEnrollmentOut])
async def list_my_enrollments(current_user: dict = Depends(get_current_user)):
    """Returns all course enrollment requests submitted by the current user."""
    db = get_db()
    user_id = str(current_user["id"])
    cursor = db.course_enrollments.find({"user_id": user_id}).sort("created_at", -1)
    reqs = await cursor.to_list(length=100)
    return serialize_list(reqs)


@router.get("/{course_id}/content")
async def get_course_workspace_content(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves all learning material for a course workspace.
    Strict RBAC:
    - Students must be approved enrolled members; only see published lectures and quizzes.
    - Teachers must be approved course instructors or admins; see all lectures and quizzes.
    """
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")
    cid = str(course["_id"])

    # Strict Membership Verification
    raw_s_ids = course.get("student_ids") or []
    s_ids = [str(x) for x in raw_s_ids if x]
    raw_t_ids = course.get("teacher_ids") or ([course.get("teacher_id")] if course.get("teacher_id") else [])
    t_ids = [str(x) for x in raw_t_ids if x]

    is_teacher_approved = (role in ["teacher", "admin"]) and (
        role == "admin"
        or user_id == str(course.get("teacher_id"))
        or user_id in t_ids
    )
    is_student_approved = (role == "student") and (
        user_id in s_ids
    )

    if not is_teacher_approved and not is_student_approved and role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not have approved enrollment in this course.",
        )

    # Fetch lectures
    lecture_query = {"course_id": cid}
    if role == "student":
        lecture_query["is_published"] = True

    cursor_lec = db.lectures.find(lecture_query).sort("created_at", -1)
    raw_lectures = await cursor_lec.to_list(length=100)
    lectures = serialize_list(raw_lectures)

    # Fetch quizzes
    quiz_query = {"course_id": cid}
    if role == "student":
        quiz_query["is_approved"] = True

    cursor_quiz = db.quizzes.find(quiz_query).sort("created_at", -1)
    raw_quizzes = await cursor_quiz.to_list(length=100)
    
    # If quizzes are stored by lecture_id, also collect quizzes from the course's lectures
    if not raw_quizzes and lectures:
        lec_ids = [l["id"] for l in lectures]
        q_filter = {"lecture_id": {"$in": lec_ids}}
        if role == "student":
            q_filter["is_approved"] = True
        cursor_quiz = db.quizzes.find(q_filter).sort("created_at", -1)
        raw_quizzes = await cursor_quiz.to_list(length=100)

    quizzes = []
    for q in raw_quizzes:
        q_dict = serialize_doc(q)
        if role == "student":
            q_dict["correct_answer"] = None
            q_dict["explanation"] = None
        quizzes.append(q_dict)

    # Enrolled students for teacher view
    enrolled_students = []
    if is_teacher_approved or role == "admin":
        st_ids = course.get("student_ids", [])
        if st_ids:
            oid_list = [ObjectId(s) for s in st_ids if ObjectId.is_valid(s)]
            str_list = [str(s) for s in st_ids]
            st_cursor = db.users.find({
                "$or": [{"_id": {"$in": oid_list}}, {"_id": {"$in": str_list}}]
            })
            raw_students = await st_cursor.to_list(length=200)
            enrolled_students = [
                {"id": str(s["_id"]), "name": s.get("name"), "email": s.get("email")}
                for s in raw_students
            ]

    return {
        "course": serialize_doc(course),
        "lectures": lectures,
        "quizzes": quizzes,
        "enrolled_students": enrolled_students,
        "is_instructor": is_teacher_approved,
    }
