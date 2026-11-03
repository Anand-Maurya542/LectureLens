import datetime
import logging
from typing import Optional
from bson import ObjectId
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings
from app.database import get_db, serialize_doc

logger = logging.getLogger("lecturelens.auth")
security = HTTPBearer(auto_error=False)

TEACHER_INVITE_SECRET = "TEACHER_SECRET_2026"


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (
        expires_delta
        if expires_delta
        else datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
        )

    db = get_db()
    # Search by ObjectId, string id, or payload email
    user = None
    try:
        if ObjectId.is_valid(user_id):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            user = await db.users.find_one({"_id": user_id})
        if not user and payload.get("email"):
            user = await db.users.find_one({"email": payload.get("email").strip().lower()})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during user authentication lookup: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is temporarily reconnecting. Please retry.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session expired or user record not found. Please sign in again.",
        )

    if user.get("status", "active") not in ["active", None]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive or suspended. Please contact an administrator.",
        )

    return serialize_doc(user)


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized platform administrators only.",
        )
    return current_user


async def require_teacher(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized instructors and administrators.",
        )
    return current_user


async def require_student(current_user: dict = Depends(get_current_user)) -> dict:
    # Teachers and admins can also access student views for review/testing
    if current_user.get("role") not in ["student", "teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student or higher access required.",
        )
    return current_user


async def seed_default_users():
    """Seed sample users for local evaluation and demonstration if none exist."""
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    seed_users = [
        {
            "name": "Prof. Rajesh Sharma",
            "email": "teacher@lecturelens.edu",
            "password_hash": hash_password("TeacherPass123!"),
            "role": "teacher",
            "status": "active",
            "created_at": now,
        },
        {
            "name": "Priya Verma",
            "email": "student@lecturelens.edu",
            "password_hash": hash_password("StudentPass123!"),
            "role": "student",
            "status": "active",
            "created_at": now,
        },
        {
            "name": "Admin User",
            "email": "admin@lecturelens.edu",
            "password_hash": hash_password("AdminPass123!"),
            "role": "admin",
            "status": "active",
            "created_at": now,
        },
    ]

    for u in seed_users:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            res = await db.users.insert_one(u)
            u["_id"] = res.inserted_id
        else:
            u["_id"] = existing["_id"]
            await db.users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"status": "active", "role": u["role"], "password_hash": u["password_hash"]}}
            )

    # Ensure CS401 exists and is active for student enrollment
    cs401 = await db.courses.find_one({
        "$or": [
            {"code": "CS401"},
            {"code": {"$regex": "^CS\\s*401$", "$options": "i"}},
        ]
    })
    if cs401:
        if cs401.get("status") != "active":
            await db.courses.update_one({"_id": cs401["_id"]}, {"$set": {"status": "active"}})
    else:
        teacher = seed_users[0]
        seed_course = {
            "title": "CS 401: Artificial Intelligence & Machine Learning",
            "description": "Fundamental concepts of modern AI, deep learning architectures, multilingual models, and vector search.",
            "code": "CS401",
            "teacher_id": str(teacher["_id"]),
            "teacher_ids": [str(teacher["_id"])],
            "student_ids": [],
            "status": "active",
            "created_at": now,
        }
        await db.courses.insert_one(seed_course)
        logger.info("Default seed users and demo CS401 course initialized.")

