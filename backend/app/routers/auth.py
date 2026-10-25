import datetime
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db, serialize_doc
from app.dependencies.auth import (
    TEACHER_INVITE_SECRET,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.schemas.user import TokenResponse, UserLogin, UserOut, UserRegister, UserRole

logger = logging.getLogger("lecturelens.router.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register_user(payload: UserRegister):
    db = get_db()
    email_clean = payload.email.strip().lower()

    # Check for existing user
    existing = await db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address is already registered.",
        )

    role = payload.role or UserRole.STUDENT

    # Guard teacher and admin privilege escalation
    if role in [UserRole.TEACHER, UserRole.ADMIN]:
        if payload.teacher_invite_code != TEACHER_INVITE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid teacher authorization invite code. Teacher accounts must be authorized.",
            )

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

    access_token = create_access_token(data={"sub": user_id, "role": role.value})

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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended.",
        )

    user_id = str(user["_id"])
    access_token = create_access_token(data={"sub": user_id, "role": user.get("role")})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_doc(user),
    }


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    return current_user

