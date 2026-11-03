import datetime
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.database import get_db, serialize_doc
from app.dependencies.auth import (
    TEACHER_INVITE_SECRET,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas.user import (
    AccountDeleteRequest,
    PasswordChangeRequest,
    TeacherAccountActivate,
    TeacherApplicationCreate,
    TeacherApplicationStatusOut,
    TeacherInvitationVerifyOut,
    TokenResponse,
    UserLogin,
    UserOut,
    UserProfileUpdate,
    UserRegister,
    UserRole,
    UserSettingsUpdate,
)

logger = logging.getLogger("lecturelens.router.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register_user(payload: UserRegister):
    db = get_db()
    email_clean = payload.email.strip().lower()

    # Public registration is strictly for students
    if payload.role and payload.role in [UserRole.TEACHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is strictly for students. Faculty and Instructor accounts are created exclusively by platform administrators.",
        )

    # Check for existing user
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered.",
        )

    role = UserRole.STUDENT

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_user = {
        "name": payload.name.strip(),
        "email": email_clean,
        "password_hash": hash_password(payload.password),
        "role": role.value,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)
    new_user["_id"] = user_id
    new_user["id"] = user_id

    access_token = create_access_token(data={"sub": user_id, "role": role.value, "email": email_clean})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(new_user),
    }


@router.post("/login", response_model=TokenResponse)
async def login_user(payload: UserLogin):
    db = get_db()
    email_clean = payload.email.strip().lower()

    user = await db.users.find_one({"email": email_clean})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        # Provide precise feedback if this email has an application in review or rejected
        app_doc = await db.teacher_applications.find_one({"email": email_clean})
        if app_doc:
            curr_status = app_doc.get("status", "pending")
            if curr_status == "pending":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Your teacher registration is currently awaiting administrator approval.",
                )
            elif curr_status == "rejected":
                reason = app_doc.get("rejection_reason") or "Application requirements not met."
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Your teacher registration application was not approved. Reason: {reason}",
                )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.get("status", "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended.",
        )

    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id, "role": user.get("role"), "email": email_clean})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(user),
    }


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserOut)
async def update_my_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates user profile information (name, bio)."""
    db = get_db()
    user_id = str(current_user["id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    update_fields = {"updated_at": now}
    if payload.name is not None and payload.name.strip():
        update_fields["name"] = payload.name.strip()
    if payload.bio is not None:
        update_fields["bio"] = payload.bio.strip()

    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": update_fields},
    )

    updated = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    return serialize_doc(updated)


@router.put("/password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Changes the authenticated user's password with verification of current password."""
    db = get_db()
    user_id = str(current_user["id"])

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long.",
        )

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_hash = hash_password(payload.new_password)

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": now}},
    )

    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": "password_change",
        "entity_type": "user",
        "entity_id": user_id,
        "timestamp": now,
    })

    return {"message": "Password changed successfully."}


@router.get("/settings")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    """Retrieves learning preferences and notification settings."""
    db = get_db()
    user_id = str(current_user["id"])

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    default_preferences = {
        "preferred_language": "en",
        "study_goal_hours": 5,
        "revision_frequency": "daily",
        "progress_visibility": "enrolled_courses",
    }
    default_notifications = {
        "email_notifications": True,
        "lecture_published": True,
        "quiz_reminders": True,
        "revision_reminders": True,
    }

    return {
        "learning_preferences": user.get("preferences", default_preferences),
        "notification_settings": user.get("notification_settings", default_notifications),
    }


@router.put("/settings")
async def update_user_settings(
    payload: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Updates learning preferences and notification settings in MongoDB."""
    db = get_db()
    user_id = str(current_user["id"])
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    update_fields = {"updated_at": now}
    if payload.learning_preferences is not None:
        update_fields["preferences"] = payload.learning_preferences
    if payload.notification_settings is not None:
        update_fields["notification_settings"] = payload.notification_settings

    await db.users.update_one(
        {"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id},
        {"$set": update_fields},
    )

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    return {
        "message": "Settings saved successfully.",
        "learning_preferences": user.get("preferences", {}),
        "notification_settings": user.get("notification_settings", {}),
    }


@router.delete("/account")
async def delete_my_account(
    payload: AccountDeleteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Permanently deletes student account with verification password."""
    db = get_db()
    user_id = str(current_user["id"])

    if current_user.get("role") == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts cannot be self-deleted. Contact another system administrator.",
        )

    user = await db.users.find_one({"_id": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Account deletion aborted.",
        )

    # Clean up student enrollments and quiz attempts
    await db.courses.update_many(
        {"student_ids": user_id},
        {"$pull": {"student_ids": user_id}},
    )
    await db.quiz_attempts.delete_many({"student_id": user_id})
    await db.users.delete_one({"_id": user["_id"]})

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": "account_deletion",
        "entity_type": "user",
        "entity_id": user_id,
        "timestamp": now,
    })

    return {"message": "Account has been permanently deleted."}


@router.post("/teacher/register")
async def register_teacher_application(payload: TeacherApplicationCreate):
    """Submits a teacher registration application requiring administrative review and approval.
    Does NOT create an active user account until an admin approves it.
    """
    db = get_db()
    email_clean = payload.email.strip().lower()

    # 1. Check if user already exists in active users collection
    existing_user = await db.users.find_one({"email": email_clean})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in.",
        )

    # 2. Check if a pending registration request already exists
    pending_app = await db.teacher_applications.find_one({
        "email": email_clean,
        "status": "pending",
    })
    if pending_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A registration request for this email is already awaiting administrator approval.",
        )

    # 3. Hash password securely
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_application = {
        "name": payload.name.strip(),
        "email": email_clean,
        "password_hash": hash_password(payload.password),
        "department": payload.department.strip() if payload.department else "",
        "institution": payload.institution.strip() if payload.institution else "",
        "bio": payload.bio.strip() if payload.bio else "",
        "requested_course_id": payload.requested_course_id,
        "status": "pending",
        "rejection_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now,
        "updated_at": now,
    }

    res = await db.teacher_applications.insert_one(new_application)
    app_id = str(res.inserted_id)

    # Log audit
    await db.audit_logs.insert_one({
        "user_id": app_id,
        "action": "teacher_application_submitted",
        "entity_type": "teacher_application",
        "entity_id": app_id,
        "email": email_clean,
        "timestamp": now,
    })

    return {
        "success": True,
        "message": "Your registration request has been submitted and is awaiting admin approval.",
        "application_id": app_id,
        "email": email_clean,
        "status": "pending",
    }


@router.get("/teacher/invitation", response_model=TeacherInvitationVerifyOut)
async def verify_teacher_invitation(token: str = Query(..., min_length=10)):
    """Verifies a time-limited teacher invitation/activation token."""
    db = get_db()
    token_clean = token.strip()

    user = await db.users.find_one({"activation_token": token_clean, "role": "teacher"})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token.",
        )

    # Check expiration
    expires_at_str = user.get("activation_expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.datetime.fromisoformat(expires_at_str)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This invitation link has expired. Please contact an administrator.",
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e

    # Hydrate assigned courses
    uid = str(user["_id"])
    c_cursor = db.courses.find({"$or": [{"teacher_id": uid}, {"teacher_ids": uid}]})
    assigned_courses = await c_cursor.to_list(50)
    courses_data = [
        {"id": str(c["_id"]), "title": c.get("title", ""), "code": c.get("code", "")}
        for c in assigned_courses
    ]

    return {
        "valid": True,
        "email": user.get("email", ""),
        "name": user.get("name", "Instructor"),
        "phone": user.get("phone", ""),
        "department": user.get("department", ""),
        "institution": user.get("institution", ""),
        "avatar_url": user.get("avatar_url", ""),
        "assigned_courses": courses_data,
    }


@router.post("/teacher/activate", response_model=TokenResponse)
async def activate_teacher_account(payload: TeacherAccountActivate):
    """Establishes the instructor password securely and activates the account."""
    db = get_db()
    token_clean = payload.token.strip()

    user = await db.users.find_one({"activation_token": token_clean, "role": "teacher"})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired invitation token.",
        )

    expires_at_str = user.get("activation_expires_at")
    if expires_at_str:
        try:
            expires_at = datetime.datetime.fromisoformat(expires_at_str)
            if datetime.datetime.now(datetime.timezone.utc) > expires_at:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This invitation link has expired. Please request a new invitation from an administrator.",
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_hash = hash_password(payload.password)

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "status": "active",
                "activated_at": now,
                "updated_at": now,
            },
            "$unset": {
                "activation_token": "",
                "activation_expires_at": "",
            },
        },
    )

    user_id = str(user["_id"])
    email_clean = user["email"]

    # Log audit
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": "teacher_account_activated",
        "entity_type": "user",
        "entity_id": user_id,
        "email": email_clean,
        "timestamp": now,
    })

    # Fetch updated user doc
    updated_user = await db.users.find_one({"_id": user["_id"]})
    access_token = create_access_token(data={"sub": user_id, "role": "teacher", "email": email_clean})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(updated_user),
    }


@router.get("/teacher/application-status", response_model=TeacherApplicationStatusOut)
async def check_teacher_application_status(email: str):
    """Allows applicant to securely inspect their registration review status."""
    db = get_db()
    email_clean = email.strip().lower()

    # Search in teacher_applications
    cursor = db.teacher_applications.find({"email": email_clean}).sort("created_at", -1)
    app_doc = await cursor.to_list(1)

    if app_doc:
        app_record = app_doc[0]
        curr_status = app_record.get("status", "pending")
        msg = "Your registration request has been submitted and is awaiting admin approval."
        if curr_status == "approved":
            msg = "Congratulations! Your instructor application has been approved. You can now log in."
        elif curr_status == "rejected":
            reason = app_record.get("rejection_reason") or "Application requirements not met."
            msg = f"Your application was not approved. Reason: {reason}"

        return {
            "email": email_clean,
            "name": app_record.get("name"),
            "status": curr_status,
            "department": app_record.get("department"),
            "institution": app_record.get("institution"),
            "rejection_reason": app_record.get("rejection_reason"),
            "created_at": app_record.get("created_at"),
            "reviewed_at": app_record.get("reviewed_at"),
            "message": msg,
        }

    # Fallback: check if already in users collection as teacher
    user = await db.users.find_one({"email": email_clean})
    if user and user.get("role") == "teacher":
        return {
            "email": email_clean,
            "name": user.get("name"),
            "status": "approved",
            "department": "",
            "institution": "",
            "rejection_reason": None,
            "created_at": user.get("created_at"),
            "reviewed_at": user.get("created_at"),
            "message": "Your instructor account is active. You may log in directly.",
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No teacher registration request was found for this email address.",
    )


@router.get("/notifications")
async def get_my_notifications(current_user: dict = Depends(get_current_user)):
    """Returns alerts and notifications for the authenticated user."""
    db = get_db()
    user_id = str(current_user["id"])
    cursor = db.notifications.find({"user_id": user_id}).sort("created_at", -1)
    notifs = await cursor.to_list(length=50)
    return serialize_list(notifs)


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Marks a notification as read."""
    db = get_db()
    user_id = str(current_user["id"])
    nid = ObjectId(notification_id) if ObjectId.is_valid(notification_id) else notification_id
    await db.notifications.update_one(
        {"_id": nid, "user_id": user_id},
        {"$set": {"is_read": True}},
    )
    return {"success": True}



