import asyncio
import datetime
import logging
import secrets
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.config import settings
from app.database import get_db, serialize_doc, serialize_list, db as db_manager
from app.dependencies.auth import require_admin, hash_password
from app.schemas.course import (
    AdminAssignTeacher,
    CourseEnrollmentOut,
    CourseEnrollmentReject,
    CourseMembersOut,
    CourseMemberUser,
    CourseOut,
)
from app.schemas.user import (
    AdminStatsOut,
    AdminTeacherCreate,
    AdminTeacherUpdate,
    AdminUserUpdate,
    TeacherApplicationOut,
    TeacherApplicationReject,
    UserOut,
    UserRole,
)

logger = logging.getLogger("lecturelens.router.admin")
router = APIRouter(prefix="/api/admin", tags=["Admin Portal"])


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_dashboard_stats(admin: dict = Depends(require_admin)):
    """Computes real-time platform statistics from MongoDB for the Admin Dashboard."""
    db = get_db()
    try:
        (
            users_c,
            students_c,
            teachers_c,
            admins_c,
            courses_c,
            lectures_c,
            processed_c,
            pending_c,
            failed_c,
            quizzes_c,
            attempts_c,
            teacher_apps_c,
            enrollments_c,
            raw_logs,
        ) = await asyncio.gather(
            db.users.count_documents({}),
            db.users.count_documents({"role": "student"}),
            db.users.count_documents({"role": "teacher"}),
            db.users.count_documents({"role": "admin"}),
            db.courses.count_documents({}),
            db.lectures.count_documents({}),
            db.lectures.count_documents({"status": {"$in": ["review_required", "published"]}}),
            db.lectures.count_documents({"status": {"$in": ["queued", "processing"]}}),
            db.lectures.count_documents({"status": "failed"}),
            db.quizzes.count_documents({}),
            db.quiz_attempts.count_documents({}),
            db.teacher_applications.count_documents({"status": "pending"}),
            db.course_enrollments.count_documents({"status": "pending"}),
            db.audit_logs.find().sort("timestamp", -1).limit(20).to_list(length=20),
            return_exceptions=True,
        )

        return {
            "total_users": users_c if isinstance(users_c, int) else 0,
            "total_students": students_c if isinstance(students_c, int) else 0,
            "total_teachers": teachers_c if isinstance(teachers_c, int) else 0,
            "total_admins": admins_c if isinstance(admins_c, int) else 0,
            "total_courses": courses_c if isinstance(courses_c, int) else 0,
            "total_lectures": lectures_c if isinstance(lectures_c, int) else 0,
            "total_processed": processed_c if isinstance(processed_c, int) else 0,
            "total_pending": pending_c if isinstance(pending_c, int) else 0,
            "total_failed": failed_c if isinstance(failed_c, int) else 0,
            "total_quizzes": quizzes_c if isinstance(quizzes_c, int) else 0,
            "total_quiz_attempts": attempts_c if isinstance(attempts_c, int) else 0,
            "pending_teacher_applications": teacher_apps_c if isinstance(teacher_apps_c, int) else 0,
            "pending_enrollment_requests": enrollments_c if isinstance(enrollments_c, int) else 0,
            "recent_activity": serialize_list(raw_logs) if isinstance(raw_logs, list) else [],
        }
    except Exception as e:
        logger.error(f"Error computing admin dashboard stats: {e}")
        return {
            "total_users": 0,
            "total_students": 0,
            "total_teachers": 0,
            "total_admins": 0,
            "total_courses": 0,
            "total_lectures": 0,
            "total_processed": 0,
            "total_pending": 0,
            "total_failed": 0,
            "total_quizzes": 0,
            "total_quiz_attempts": 0,
            "pending_teacher_applications": 0,
            "pending_enrollment_requests": 0,
            "recent_activity": [],
        }


@router.get("/users", response_model=list[UserOut])
async def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    admin: dict = Depends(require_admin),
):
    """Lists registered platform users with search and role filtering."""
    db = get_db()
    query = {}

    if role and role.strip() and role != "all":
        query["role"] = role.strip().lower()

    if status_filter and status_filter.strip() and status_filter != "all":
        query["status"] = status_filter.strip().lower()

    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"name": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
        ]

    try:
        cursor = db.users.find(query).sort("created_at", -1)
        users = await cursor.to_list(length=200)

        # Hydrate all active courses to map teacher assignments
        all_courses = await db.courses.find({}).to_list(200)

        result = []
        for u in users:
            s_u = serialize_doc(u)
            if not s_u:
                continue
            s_u.setdefault("name", "User")
            s_u.setdefault("email", "")
            s_u.setdefault("role", "student")
            s_u.setdefault("status", "active")
            s_u.setdefault("phone", "")
            s_u.setdefault("department", "")
            s_u.setdefault("institution", "")
            s_u.setdefault("avatar_url", "")
            s_u.setdefault("admin_created", False)

            uid = str(u["_id"])
            # Match courses
            user_courses = []
            for c in all_courses:
                cid = str(c["_id"])
                raw_t_ids = [str(x) for x in (c.get("teacher_ids") or []) if x]
                primary_t = str(c.get("teacher_id")) if c.get("teacher_id") else None
                if uid == primary_t or uid in raw_t_ids:
                    user_courses.append({
                        "id": cid,
                        "title": c.get("title", "Untitled Course"),
                        "code": c.get("code", ""),
                        "status": c.get("status", "active"),
                    })

            s_u["assigned_courses"] = user_courses
            s_u["assigned_course_ids"] = [c["id"] for c in user_courses]

            if u.get("activation_token"):
                s_u["invitation_link"] = f"/activate-teacher?token={u['activation_token']}"

            result.append(s_u)
        return result
    except Exception as e:
        logger.error(f"Error listing users for admin: {e}")
        return []


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user_status_or_role(
    user_id: str,
    payload: AdminUserUpdate,
    admin: dict = Depends(require_admin),
):
    """Allows an administrator to modify user role and activate/deactivate accounts."""
    db = get_db()
    admin_id = str(admin["id"])

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = str(user["_id"])

    # Prevent admin from deactivating or demoting their own current session
    if target_id == admin_id:
        if payload.status and payload.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own active admin account.",
            )
        if payload.role and payload.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot revoke your own administrator privileges.",
            )

    update_fields = {}
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_fields["updated_at"] = now

    if payload.role is not None:
        update_fields["role"] = payload.role.value
    if payload.status is not None:
        valid_statuses = ["active", "inactive", "suspended"]
        if payload.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        update_fields["status"] = payload.status

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": update_fields},
    )

    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "admin_user_update",
        "entity_type": "user",
        "entity_id": target_id,
        "diff": update_fields,
        "timestamp": now,
    })

    updated = await db.users.find_one({"_id": user["_id"]})
    return serialize_doc(updated)


@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: str,
    admin: dict = Depends(require_admin),
):
    """Permanently deletes a user account across courses and assessment records."""
    db = get_db()
    admin_id = str(admin["id"])

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    target_id = str(user["_id"])
    if target_id == admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account.",
        )

    # Clean up relations
    await db.courses.update_many(
        {"student_ids": target_id},
        {"$pull": {"student_ids": target_id}},
    )
    await db.quiz_attempts.delete_many({"student_id": target_id})
    await db.users.delete_one({"_id": user["_id"]})

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "admin_user_delete",
        "entity_type": "user",
        "entity_id": target_id,
        "timestamp": now,
    })

    return {"message": f"User {user.get('email')} permanently deleted."}


@router.post("/teachers", response_model=UserOut)
async def create_teacher_by_admin(
    payload: AdminTeacherCreate,
    admin: dict = Depends(require_admin),
):
    """Admin manually creates a new Teacher profile, generates an activation invitation,
    and assigns the teacher to one or more courses.
    """
    db = get_db()
    email_clean = payload.email.strip().lower()

    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{email_clean}' already exists.",
        )

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now = now_dt.isoformat()
    activation_expires_at = (now_dt + datetime.timedelta(days=7)).isoformat()
    activation_token = secrets.token_urlsafe(32)

    # If admin specified a password directly
    if payload.password and len(payload.password.strip()) >= 6:
        password_hash = hash_password(payload.password.strip())
        account_status = "active"
    else:
        # Teacher establishes their own password via secure activation invitation
        password_hash = hash_password(secrets.token_hex(32))
        account_status = "pending_activation"

    new_user = {
        "name": payload.name.strip(),
        "email": email_clean,
        "password_hash": password_hash,
        "role": "teacher",
        "status": account_status,
        "phone": payload.phone.strip() if payload.phone else "",
        "department": payload.department.strip() if payload.department else "",
        "institution": payload.institution.strip() if payload.institution else "",
        "bio": payload.bio.strip() if payload.bio else "",
        "avatar_url": payload.avatar_url.strip() if payload.avatar_url else "",
        "admin_created": True,
        "activation_token": activation_token,
        "activation_expires_at": activation_expires_at,
        "created_at": now,
        "updated_at": now,
    }

    res = await db.users.insert_one(new_user)
    user_id = str(res.inserted_id)
    new_user["_id"] = user_id
    new_user["id"] = user_id

    # Combine assigned courses from course_ids list and legacy assigned_course_id
    target_cids = list(payload.course_ids)
    if payload.assigned_course_id and payload.assigned_course_id not in target_cids:
        target_cids.append(payload.assigned_course_id)

    assigned_courses = []
    for cid_raw in target_cids:
        cid = str(cid_raw).strip()
        if not cid:
            continue
        c_query = {"_id": ObjectId(cid)} if ObjectId.is_valid(cid) else {"_id": cid}
        course = await db.courses.find_one(c_query)
        if course:
            course_id_str = str(course["_id"])
            update_op = {"$addToSet": {"teacher_ids": user_id}}
            if not course.get("teacher_id"):
                update_op["$set"] = {"teacher_id": user_id, "teacher_name": new_user["name"]}
            await db.courses.update_one(c_query, update_op)

            # Record approved course enrollment
            enrollment_doc = {
                "course_id": course_id_str,
                "course_title": course.get("title", ""),
                "course_code": course.get("code", ""),
                "user_id": user_id,
                "user_name": new_user["name"],
                "user_email": email_clean,
                "user_role": "teacher",
                "status": "approved",
                "created_at": now,
                "reviewed_by": str(admin["id"]),
                "reviewed_at": now,
            }
            await db.course_enrollments.update_one(
                {"course_id": course_id_str, "user_id": user_id},
                {"$set": enrollment_doc},
                upsert=True,
            )
            assigned_courses.append({
                "id": course_id_str,
                "title": course.get("title", "Untitled Course"),
                "code": course.get("code", ""),
            })

    # In-app notification for the teacher
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": "Welcome to LectureLens Faculty",
        "message": "Your instructor profile has been created by an administrator. Please activate your account.",
        "type": "account_created",
        "invitation_token": activation_token,
        "is_read": False,
        "created_at": now,
    })

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": str(admin["id"]),
        "action": "admin_create_teacher",
        "entity_type": "user",
        "entity_id": user_id,
        "email": email_clean,
        "course_ids": [c["id"] for c in assigned_courses],
        "timestamp": now,
    })

    ret = serialize_doc(new_user)
    ret["assigned_courses"] = assigned_courses
    ret["assigned_course_ids"] = [c["id"] for c in assigned_courses]
    ret["invitation_link"] = f"/activate-teacher?token={activation_token}"
    return ret


@router.patch("/teachers/{teacher_id}", response_model=UserOut)
async def update_teacher_profile(
    teacher_id: str,
    payload: AdminTeacherUpdate,
    admin: dict = Depends(require_admin),
):
    """Allows admin to update teacher profile, bio, department, status, and course assignments."""
    db = get_db()
    tid = str(teacher_id).strip()
    t_query = {"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"_id": tid}
    teacher = await db.users.find_one(t_query)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    user_id = str(teacher["_id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_fields = {"updated_at": now}

    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.department is not None:
        update_fields["department"] = payload.department.strip()
    if payload.institution is not None:
        update_fields["institution"] = payload.institution.strip()
    if payload.bio is not None:
        update_fields["bio"] = payload.bio.strip()
    if payload.avatar_url is not None:
        update_fields["avatar_url"] = payload.avatar_url.strip()
    if payload.status is not None:
        if payload.status not in ["active", "inactive", "suspended", "pending_activation"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
        update_fields["status"] = payload.status

    await db.users.update_one(t_query, {"$set": update_fields})

    # Manage course assignments if course_ids is supplied
    if payload.course_ids is not None:
        target_cids = [str(x) for x in payload.course_ids if x]
        current_courses = await db.courses.find({"$or": [{"teacher_id": user_id}, {"teacher_ids": user_id}]}).to_list(100)
        current_cids = [str(c["_id"]) for c in current_courses]

        # Add to newly assigned courses
        for cid in target_cids:
            if cid not in current_cids:
                c_query = {"_id": ObjectId(cid)} if ObjectId.is_valid(cid) else {"_id": cid}
                c_doc = await db.courses.find_one(c_query)
                if c_doc:
                    c_id_str = str(c_doc["_id"])
                    await db.courses.update_one(c_query, {"$addToSet": {"teacher_ids": user_id}})
                    await db.course_enrollments.update_one(
                        {"course_id": c_id_str, "user_id": user_id},
                        {
                            "$set": {
                                "course_id": c_id_str,
                                "course_title": c_doc.get("title", ""),
                                "course_code": c_doc.get("code", ""),
                                "user_id": user_id,
                                "user_name": update_fields.get("name", teacher.get("name", "")),
                                "user_email": teacher.get("email", ""),
                                "user_role": "teacher",
                                "status": "approved",
                                "created_at": now,
                                "reviewed_by": str(admin["id"]),
                                "reviewed_at": now,
                            }
                        },
                        upsert=True,
                    )

        # Remove from unassigned courses
        for cid in current_cids:
            if cid not in target_cids:
                c_query = {"_id": ObjectId(cid)} if ObjectId.is_valid(cid) else {"_id": cid}
                await db.courses.update_one(c_query, {"$pull": {"teacher_ids": user_id}})
                await db.course_enrollments.delete_one({"course_id": cid, "user_id": user_id})

    # Hydrate assigned courses
    assigned_c_docs = await db.courses.find({"$or": [{"teacher_id": user_id}, {"teacher_ids": user_id}]}).to_list(100)
    assigned_courses = [
        {"id": str(c["_id"]), "title": c.get("title", ""), "code": c.get("code", "")}
        for c in assigned_c_docs
    ]

    updated_teacher = await db.users.find_one(t_query)
    ret = serialize_doc(updated_teacher)
    ret["assigned_courses"] = assigned_courses
    ret["assigned_course_ids"] = [c["id"] for c in assigned_courses]
    if updated_teacher.get("activation_token"):
        ret["invitation_link"] = f"/activate-teacher?token={updated_teacher['activation_token']}"
    return ret


@router.post("/teachers/{teacher_id}/resend-invitation")
async def resend_teacher_invitation(
    teacher_id: str,
    admin: dict = Depends(require_admin),
):
    """Regenerates a fresh, time-limited activation invitation token for a teacher."""
    db = get_db()
    tid = str(teacher_id).strip()
    t_query = {"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"_id": tid}
    teacher = await db.users.find_one(t_query)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    token = secrets.token_urlsafe(32)
    expires_at = (now_dt + datetime.timedelta(days=7)).isoformat()

    await db.users.update_one(
        t_query,
        {
            "$set": {
                "activation_token": token,
                "activation_expires_at": expires_at,
                "updated_at": now_dt.isoformat(),
            }
        },
    )

    return {
        "success": True,
        "message": f"Fresh activation invitation generated for {teacher.get('name')}.",
        "activation_token": token,
        "invitation_link": f"/activate-teacher?token={token}",
    }


@router.get("/lectures")
async def list_all_lectures_admin(admin: dict = Depends(require_admin)):
    """Lists all lectures on the platform with teacher and course metadata."""
    db = get_db()
    try:
        cursor = db.lectures.find().sort("created_at", -1)
        lectures = await cursor.to_list(length=300)

        # Hydrate courses and teachers
        try:
            courses = await db.courses.find().to_list(100)
            course_map = {str(c.get("_id", c.get("id", ""))): c.get("title", "Untitled Course") for c in courses if c}
        except Exception:
            course_map = {}

        try:
            users = await db.users.find().to_list(200)
            user_map = {str(u.get("_id", u.get("id", ""))): u.get("name", u.get("email", "Unknown")) for u in users if u}
        except Exception:
            user_map = {}

        result = []
        for lec in lectures:
            lec_dict = serialize_doc(lec)
            if not lec_dict:
                continue
            cid = str(lec.get("course_id", ""))
            tid = str(lec.get("teacher_id", ""))
            lec_dict["course_title"] = course_map.get(cid, "Unassigned Course")
            lec_dict["teacher_name"] = user_map.get(tid, "Unknown Teacher")
            result.append(lec_dict)

        return result
    except Exception as e:
        logger.error(f"Error listing all lectures for admin: {e}")
        return []


@router.delete("/lectures/{lecture_id}")
async def delete_lecture_admin(
    lecture_id: str,
    admin: dict = Depends(require_admin),
):
    """Deletes a lecture and all its transcripts, topics, summaries, and chunks."""
    db = get_db()
    admin_id = str(admin["id"])

    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    target_id = str(lec["_id"])

    # Cascade deletion across collections
    await db.transcript_segments.delete_many({"lecture_id": target_id})
    await db.topics.delete_many({"lecture_id": target_id})
    await db.summaries.delete_many({"lecture_id": target_id})
    await db.lecture_chunks.delete_many({"lecture_id": target_id})
    await db.quizzes.delete_many({"lecture_id": target_id})
    await db.quiz_attempts.delete_many({"lecture_id": target_id})
    await db.lectures.delete_one({"_id": lec["_id"]})

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "admin_lecture_delete",
        "entity_type": "lecture",
        "entity_id": target_id,
        "title": lec.get("title", ""),
        "timestamp": now,
    })

    return {"message": f"Lecture '{lec.get('title')}' and all associated AI assets deleted."}


@router.get("/system")
async def get_system_status(admin: dict = Depends(require_admin)):
    """Returns platform operational status, MongoDB connection info, and AI models."""
    db = get_db()
    collections_info = {}
    failed_lectures = []
    try:
        colls = [
            "users", "courses", "lectures", "transcript_segments",
            "topics", "summaries", "lecture_chunks", "quizzes",
            "quiz_attempts", "audit_logs"
        ]
        counts = await asyncio.gather(
            *[db[col].count_documents({}) for col in colls],
            db.lectures.find({"status": "failed"}).sort("updated_at", -1).limit(5).to_list(5),
            return_exceptions=True,
        )
        for i, col in enumerate(colls):
            val = counts[i]
            collections_info[col] = val if isinstance(val, int) else 0
        failed_res = counts[-1]
        failed_lectures = failed_res if isinstance(failed_res, list) else []
    except Exception as e:
        logger.error(f"Error querying collections for system status: {e}")
        collections_info = {}
        failed_lectures = []

    return {
        "status": "healthy",
        "environment": settings.APP_ENV,
        "database_connected": bool(db_manager.db is not None),
        "database_mode": "mock_development" if db_manager.is_mock else "mongodb_atlas",
        "database_name": settings.MONGODB_DB_NAME,
        "collections": collections_info,
        "whisper_config": {
            "model_size": settings.WHISPER_MODEL_SIZE,
            "device": settings.WHISPER_DEVICE,
            "compute_type": settings.WHISPER_COMPUTE_TYPE,
        },
        "embedding_config": {
            "model_name": settings.EMBEDDING_MODEL_NAME,
            "dimension": settings.EMBEDDING_DIMENSION,
            "vector_index_name": settings.ATLAS_VECTOR_INDEX_NAME,
        },
        "failed_jobs": serialize_list(failed_lectures),
    }


@router.get("/teacher-applications", response_model=list[TeacherApplicationOut])
async def list_teacher_applications(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by pending, approved, rejected"),
    admin: dict = Depends(require_admin),
):
    """Lists teacher registration applications awaiting or completed administrative review."""
    db = get_db()
    query = {}
    if status_filter and status_filter.strip() and status_filter != "all":
        query["status"] = status_filter.strip().lower()

    try:
        cursor = db.teacher_applications.find(query).sort("created_at", -1)
        applications = await cursor.to_list(length=200)
        result = []
        for app in applications:
            s_app = serialize_doc(app)
            if not s_app:
                continue
            s_app.setdefault("name", "Applicant")
            s_app.setdefault("email", "")
            s_app.setdefault("status", "pending")
            result.append(s_app)
        return result
    except Exception as e:
        logger.error(f"Error listing teacher applications for admin: {e}")
        return []


@router.post("/teacher-applications/{application_id}/approve")
async def approve_teacher_application(
    application_id: str,
    admin: dict = Depends(require_admin),
):
    """Approves a teacher application, provisioning an active teacher user account in MongoDB."""
    db = get_db()
    admin_id = str(admin["id"])

    app_doc = await db.teacher_applications.find_one(
        {"_id": ObjectId(application_id) if ObjectId.is_valid(application_id) else application_id}
    )
    if not app_doc:
        raise HTTPException(status_code=404, detail="Teacher application not found")

    if app_doc.get("status") == "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This application has already been approved.",
        )

    email_clean = app_doc["email"].strip().lower()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Check if a user account already exists for this email
    existing_user = await db.users.find_one({"email": email_clean})
    if existing_user:
        # If user already exists, update their role to teacher
        await db.users.update_one(
            {"_id": existing_user["_id"]},
            {"$set": {"role": "teacher", "status": "active", "updated_at": now}},
        )
        created_user_id = str(existing_user["_id"])
    else:
        # Create new active teacher user with the pre-hashed password
        bio_parts = [
            app_doc.get("department", "").strip(),
            app_doc.get("institution", "").strip(),
            app_doc.get("bio", "").strip(),
        ]
        bio_combined = " · ".join([p for p in bio_parts if p])

        new_user = {
            "name": app_doc["name"].strip(),
            "email": email_clean,
            "password_hash": app_doc["password_hash"],
            "role": "teacher",
            "status": "active",
            "bio": bio_combined,
            "created_at": now,
            "updated_at": now,
        }
        res = await db.users.insert_one(new_user)
        created_user_id = str(res.inserted_id)

    # Update application status
    await db.teacher_applications.update_one(
        {"_id": app_doc["_id"]},
        {
            "$set": {
                "status": "approved",
                "reviewed_by": admin_id,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    # If the teacher requested to instruct a course during application, assign them now
    req_course_id = app_doc.get("requested_course_id")
    if req_course_id:
        req_c = await db.courses.find_one(
            {"_id": ObjectId(req_course_id) if ObjectId.is_valid(req_course_id) else req_course_id}
        )
        if req_c:
            await db.courses.update_one(
                {"_id": req_c["_id"]},
                {"$addToSet": {"teacher_ids": created_user_id}}
            )
            await db.course_enrollments.update_one(
                {"course_id": str(req_c["_id"]), "user_id": created_user_id},
                {
                    "$set": {
                        "course_id": str(req_c["_id"]),
                        "course_title": req_c.get("title"),
                        "course_code": req_c.get("code"),
                        "user_id": created_user_id,
                        "user_name": app_doc.get("name"),
                        "user_email": email_clean,
                        "user_role": "teacher",
                        "status": "approved",
                        "created_at": now,
                        "reviewed_by": admin_id,
                        "reviewed_at": now,
                    }
                },
                upsert=True,
            )

    # Emit notification
    await db.notifications.insert_one({
        "user_id": created_user_id,
        "email": email_clean,
        "title": "Faculty Registration Approved",
        "message": f"Welcome {app_doc['name']}! Your faculty account has been approved and activated.",
        "type": "teacher_application_approved",
        "is_read": False,
        "created_at": now,
    })

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "teacher_application_approved",
        "entity_type": "teacher_application",
        "entity_id": str(app_doc["_id"]),
        "created_user_id": created_user_id,
        "email": email_clean,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Application for {app_doc['name']} approved. Teacher account activated.",
        "user_id": created_user_id,
        "email": email_clean,
    }


@router.post("/teacher-applications/{application_id}/reject")
async def reject_teacher_application(
    application_id: str,
    payload: TeacherApplicationReject,
    admin: dict = Depends(require_admin),
):
    """Rejects a teacher application with an explicit reason; does not create a teacher account."""
    db = get_db()
    admin_id = str(admin["id"])

    app_doc = await db.teacher_applications.find_one(
        {"_id": ObjectId(application_id) if ObjectId.is_valid(application_id) else application_id}
    )
    if not app_doc:
        raise HTTPException(status_code=404, detail="Teacher application not found")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reason = payload.rejection_reason or "Application requirements not met."

    await db.teacher_applications.update_one(
        {"_id": app_doc["_id"]},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "reviewed_by": admin_id,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    await db.notifications.insert_one({
        "user_id": None,
        "email": app_doc.get("email"),
        "title": "Faculty Registration Status",
        "message": f"Your faculty application was declined: {reason}",
        "type": "teacher_application_rejected",
        "is_read": False,
        "created_at": now,
    })

    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "teacher_application_rejected",
        "entity_type": "teacher_application",
        "entity_id": str(app_doc["_id"]),
        "rejection_reason": reason,
        "email": app_doc.get("email"),
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Application for {app_doc.get('name')} rejected.",
        "rejection_reason": reason,
    }


# ==========================================
# COURSE MANAGEMENT & ENROLLMENTS (ADMIN)
# ==========================================

@router.get("/courses", response_model=list[CourseOut])
async def list_admin_courses(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    admin: dict = Depends(require_admin),
):
    """Lists all platform courses with complete statistics for administration."""
    db = get_db()
    query = {}
    if status_filter and status_filter != "all":
        if status_filter == "active":
            query = {"$or": [{"status": "active"}, {"status": {"$exists": False}}, {"status": None}]}
        else:
            query["status"] = status_filter
    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"code": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
        ]

    try:
        cursor = db.courses.find(query).sort("created_at", -1)
        courses = await cursor.to_list(length=200)

        async def hydrate_course(c):
            cid = str(c.get("_id", c.get("id", "")))
            try:
                counts = await asyncio.gather(
                    db.lectures.count_documents({"course_id": cid}),
                    db.course_enrollments.count_documents({"course_id": cid, "status": "pending"}),
                    return_exceptions=True,
                )
                lec_count = counts[0] if isinstance(counts[0], int) else 0
                pending_count = counts[1] if isinstance(counts[1], int) else 0
            except Exception:
                lec_count = 0
                pending_count = 0

            raw_s_ids = c.get("student_ids") or []
            s_ids = [str(x) for x in raw_s_ids if x]
            student_count = len(s_ids)

            teacher_name = c.get("teacher_name") or "Instructor"
            tid = c.get("teacher_id")
            if tid:
                try:
                    t_user = await db.users.find_one({"_id": ObjectId(tid) if ObjectId.is_valid(tid) else tid})
                    if t_user and t_user.get("name"):
                        teacher_name = t_user["name"]
                except Exception:
                    pass

            c_serialized = serialize_doc(c) or {}
            c_serialized["lecture_count"] = lec_count
            c_serialized["student_count"] = student_count
            c_serialized["pending_requests_count"] = pending_count
            c_serialized["teacher_name"] = teacher_name
            raw_t_ids = c.get("teacher_ids") or ([c.get("teacher_id")] if c.get("teacher_id") else [])
            c_serialized["teacher_ids"] = [str(x) for x in raw_t_ids if x]
            c_serialized["student_ids"] = s_ids
            c_serialized["status"] = c.get("status", "active")
            c_serialized["code"] = c.get("code", "")
            c_serialized["title"] = c.get("title", "Untitled Course")
            return c_serialized

        result = await asyncio.gather(*[hydrate_course(c) for c in courses])
        return list(result)
    except Exception as e:
        logger.error(f"Error listing admin courses: {e}")
        return []


@router.get("/courses/{course_id}/members", response_model=CourseMembersOut)
async def get_course_members(
    course_id: str,
    admin: dict = Depends(require_admin),
):
    """Retrieves all teachers, students, and pending enrollment requests for a specific course."""
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    cid = str(course.get("_id", course.get("id", "")))

    # Enrolled teachers
    raw_t_ids = course.get("teacher_ids") or ([course.get("teacher_id")] if course.get("teacher_id") else [])
    t_ids = [str(x) for x in raw_t_ids if x]
    teachers = []
    for tid in t_ids:
        if not tid:
            continue
        try:
            t_user = await db.users.find_one({"_id": ObjectId(tid) if ObjectId.is_valid(tid) else tid})
        except Exception:
            t_user = None
        if t_user:
            teachers.append({
                "id": str(t_user.get("_id", t_user.get("id", ""))),
                "name": t_user.get("name", "Instructor"),
                "email": t_user.get("email", ""),
                "role": "teacher",
                "joined_at": serialize_doc(t_user.get("created_at")),
            })

    # Enrolled students
    raw_s_ids = course.get("student_ids") or []
    s_ids = [str(x) for x in raw_s_ids if x]
    students = []
    for sid in s_ids:
        if not sid:
            continue
        try:
            s_user = await db.users.find_one({"_id": ObjectId(sid) if ObjectId.is_valid(sid) else sid})
        except Exception:
            s_user = None
        if s_user:
            students.append({
                "id": str(s_user.get("_id", s_user.get("id", ""))),
                "name": s_user.get("name", "Student"),
                "email": s_user.get("email", ""),
                "role": "student",
                "joined_at": serialize_doc(s_user.get("created_at")),
            })

    # Pending enrollment requests
    try:
        cursor_reqs = db.course_enrollments.find({"course_id": cid, "status": "pending"}).sort("created_at", -1)
        raw_reqs = await cursor_reqs.to_list(length=100)
        pending_requests = serialize_list(raw_reqs)
    except Exception:
        pending_requests = []

    return {
        "course_id": cid,
        "course_title": course.get("title", "Untitled Course"),
        "course_code": course.get("code", ""),
        "teachers": teachers,
        "students": students,
        "pending_requests": pending_requests,
    }


@router.delete("/courses/{course_id}/members/{user_id}")
async def remove_course_member(
    course_id: str,
    user_id: str,
    admin: dict = Depends(require_admin),
):
    """Removes a teacher or student from a course."""
    db = get_db()
    course = await db.courses.find_one(
        {"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    cid = str(course["_id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Remove from student_ids and teacher_ids
    await db.courses.update_one(
        {"_id": course["_id"]},
        {
            "$pull": {
                "student_ids": user_id,
                "teacher_ids": user_id,
            }
        },
    )

    # Delete or set enrollment status to removed
    await db.course_enrollments.delete_one({"course_id": cid, "user_id": user_id})

    # Log audit
    await db.audit_logs.insert_one({
        "user_id": str(admin["id"]),
        "action": "course_member_removed",
        "entity_type": "course_member",
        "entity_id": f"{cid}:{user_id}",
        "course_id": cid,
        "target_user_id": user_id,
        "timestamp": now,
    })

    return {"success": True, "message": f"Member {user_id} removed from course {course.get('title')}."}


@router.post("/courses/{course_id}/assign-teacher")
async def assign_teacher_to_course(
    course_id: str,
    payload: AdminAssignTeacher,
    admin: dict = Depends(require_admin),
):
    """Admin assigns an existing teacher to a course."""
    db = get_db()
    cid = str(course_id).strip()
    course_query = {"_id": ObjectId(cid)} if ObjectId.is_valid(cid) else {"_id": cid}
    course = await db.courses.find_one(course_query)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    tid = str(payload.teacher_id).strip()
    teacher_query = {"_id": ObjectId(tid)} if ObjectId.is_valid(tid) else {"_id": tid}
    teacher = await db.users.find_one(teacher_query)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if teacher.get("role") not in ["teacher", "admin"]:
        raise HTTPException(status_code=400, detail="Target user does not have teacher or faculty role")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    canonical_cid = str(course["_id"])
    canonical_tid = str(teacher["_id"])

    update_op = {"$addToSet": {"teacher_ids": canonical_tid}}
    if not course.get("teacher_id"):
        update_op["$set"] = {"teacher_id": canonical_tid, "teacher_name": teacher.get("name", "")}

    await db.courses.update_one(course_query, update_op)

    # Upsert approved course enrollment
    enrollment_doc = {
        "course_id": canonical_cid,
        "course_title": course.get("title", ""),
        "course_code": course.get("code", ""),
        "user_id": canonical_tid,
        "user_name": teacher.get("name", "Faculty Member"),
        "user_email": teacher.get("email", ""),
        "user_role": "teacher",
        "status": "approved",
        "created_at": now,
        "reviewed_by": str(admin["id"]),
        "reviewed_at": now,
    }
    await db.course_enrollments.update_one(
        {"course_id": canonical_cid, "user_id": canonical_tid},
        {"$set": enrollment_doc},
        upsert=True,
    )

    # Log audit
    await db.audit_logs.insert_one({
        "user_id": str(admin["id"]),
        "action": "admin_assign_teacher_to_course",
        "entity_type": "course_membership",
        "entity_id": f"{canonical_cid}:{canonical_tid}",
        "course_id": canonical_cid,
        "teacher_id": canonical_tid,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Successfully assigned {teacher.get('name', 'teacher')} to {course.get('title', 'course')}.",
        "course_id": canonical_cid,
        "teacher_id": canonical_tid,
    }


@router.get("/enrollments", response_model=list[CourseEnrollmentOut])
async def list_course_enrollments(
    status_filter: Optional[str] = Query(None, alias="status"),
    role_filter: Optional[str] = Query(None, alias="role"),
    course_id: Optional[str] = Query(None),
    admin: dict = Depends(require_admin),
):
    """Lists course enrollment requests with filters by status, user role, and course."""
    db = get_db()
    query = {}
    if status_filter and status_filter.strip() and status_filter != "all":
        query["status"] = status_filter.strip().lower()
    if role_filter and role_filter.strip() and role_filter != "all":
        query["user_role"] = role_filter.strip().lower()
    if course_id and course_id.strip() and course_id != "all":
        query["course_id"] = course_id.strip()

    try:
        cursor = db.course_enrollments.find(query).sort("created_at", -1)
        reqs = await cursor.to_list(length=300)
        result = []
        for r in reqs:
            s_r = serialize_doc(r)
            if not s_r:
                continue
            s_r.setdefault("status", "pending")
            s_r.setdefault("user_role", "student")
            result.append(s_r)
        return result
    except Exception as e:
        logger.error(f"Error listing course enrollments for admin: {e}")
        return []


@router.post("/enrollments/{enrollment_id}/approve")
async def approve_course_enrollment(
    enrollment_id: str,
    admin: dict = Depends(require_admin),
):
    """Approves a student or teacher course enrollment request."""
    db = get_db()
    admin_id = str(admin["id"])

    req = await db.course_enrollments.find_one(
        {"_id": ObjectId(enrollment_id) if ObjectId.is_valid(enrollment_id) else enrollment_id}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Enrollment request not found.")

    cid = str(req["course_id"])
    uid = str(req["user_id"])
    role = req.get("user_role", "student")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    course = await db.courses.find_one(
        {"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Associated course not found.")

    # Update course memberships
    if role == "teacher":
        await db.courses.update_one(
            {"_id": course["_id"]},
            {"$addToSet": {"teacher_ids": uid}}
        )
    else:
        await db.courses.update_one(
            {"_id": course["_id"]},
            {"$addToSet": {"student_ids": uid}}
        )

    # Update enrollment status
    await db.course_enrollments.update_one(
        {"_id": req["_id"]},
        {
            "$set": {
                "status": "approved",
                "reviewed_by": admin_id,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    # Emit notification
    await db.notifications.insert_one({
        "user_id": uid,
        "email": req.get("user_email"),
        "title": "Course Enrollment Approved",
        "message": f"Your enrollment request for {course.get('title')} ({course.get('code')}) has been approved.",
        "type": "enrollment_approved",
        "course_id": cid,
        "is_read": False,
        "created_at": now,
    })

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "course_enrollment_approved",
        "entity_type": "course_enrollment",
        "entity_id": str(req["_id"]),
        "course_id": cid,
        "user_id_target": uid,
        "role": role,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Enrollment for {req.get('user_name')} in {course.get('title')} approved.",
        "course_id": cid,
        "user_id": uid,
        "role": role,
    }


@router.post("/enrollments/{enrollment_id}/reject")
async def reject_course_enrollment(
    enrollment_id: str,
    payload: CourseEnrollmentReject,
    admin: dict = Depends(require_admin),
):
    """Rejects a course enrollment request with a specified reason."""
    db = get_db()
    admin_id = str(admin["id"])

    req = await db.course_enrollments.find_one(
        {"_id": ObjectId(enrollment_id) if ObjectId.is_valid(enrollment_id) else enrollment_id}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Enrollment request not found.")

    cid = str(req["course_id"])
    uid = str(req["user_id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reason = payload.rejection_reason or "Enrollment criteria not met."

    await db.course_enrollments.update_one(
        {"_id": req["_id"]},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "reviewed_by": admin_id,
                "reviewed_at": now,
                "updated_at": now,
            }
        },
    )

    # Emit notification
    await db.notifications.insert_one({
        "user_id": uid,
        "email": req.get("user_email"),
        "title": "Course Enrollment Rejected",
        "message": f"Your enrollment request for {req.get('course_title')} was declined: {reason}",
        "type": "enrollment_rejected",
        "course_id": cid,
        "is_read": False,
        "created_at": now,
    })

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": admin_id,
        "action": "course_enrollment_rejected",
        "entity_type": "course_enrollment",
        "entity_id": str(req["_id"]),
        "course_id": cid,
        "user_id_target": uid,
        "rejection_reason": reason,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": f"Enrollment for {req.get('user_name')} rejected.",
        "rejection_reason": reason,
    }


