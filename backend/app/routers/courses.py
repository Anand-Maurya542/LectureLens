import datetime
import logging
import random
import string
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db, serialize_doc, serialize_list
from app.dependencies.auth import get_current_user, require_teacher
from app.schemas.course import CourseCreate, CourseEnroll, CourseOut

logger = logging.getLogger("lecturelens.router.courses")
router = APIRouter(prefix="/api/courses", tags=["Courses"])


def generate_course_code() -> str:
    """Generates a random 6-character uppercase alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))


@router.get("", response_model=list[CourseOut])
async def list_courses(current_user: dict = Depends(get_current_user)):
    db = get_db()
    role = current_user.get("role")
    user_id = str(current_user["id"])

    if role in ["teacher", "admin"]:
        # Teachers see courses they own or instruct
        query = {"teacher_id": user_id} if role == "teacher" else {}
    else:
        # Students see courses they are enrolled in
        query = {"student_ids": user_id}

    cursor = db.courses.find(query).sort("created_at", -1)
    courses = await cursor.to_list(length=100)

    # Hydrate with lecture and student counts
    result = []
    for c in courses:
        cid = str(c["_id"])
        lec_count = await db.lectures.count_documents({"course_id": cid})
        student_count = len(c.get("student_ids", []))
        
        # Hydrate teacher name
        t_user = None
        try:
            t_user = await db.users.find_one({"_id": ObjectId(c.get("teacher_id"))})
        except Exception:
            pass
        if not t_user:
            t_user = await db.users.find_one({"_id": c.get("teacher_id")})
        teacher_name = t_user.get("name") if t_user else "Instructor"

        c_serialized = serialize_doc(c)
        c_serialized["lecture_count"] = lec_count
        c_serialized["student_count"] = student_count
        c_serialized["teacher_name"] = teacher_name
        result.append(c_serialized)

    return result


@router.post("", response_model=CourseOut)
async def create_course(
    payload: CourseCreate,
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    code = payload.code.upper().strip() if payload.code else generate_course_code()
    
    # Verify uniqueness of course code
    existing = await db.courses.find_one({"code": code})
    if existing:
        code = generate_course_code()

    new_course = {
        "title": payload.title.strip(),
        "description": payload.description or "",
        "code": code,
        "teacher_id": str(teacher["id"]),
        "student_ids": [],
        "created_at": now,
        "updated_at": now,
    }

    insert_res = await db.courses.insert_one(new_course)
    course_id = str(insert_res.inserted_id)
    new_course["_id"] = course_id
    new_course["id"] = course_id
    new_course["teacher_name"] = teacher.get("name")
    new_course["student_count"] = 0
    new_course["lecture_count"] = 0

    return serialize_doc(new_course)


@router.get("/{course_id}", response_model=CourseOut)
async def get_course_detail(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    course = None
    try:
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
    except Exception:
        pass
    if not course:
        course = await db.courses.find_one({"_id": course_id})

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")

    # Access control: student must be enrolled, teacher must own it, or admin
    if role == "student" and user_id not in course.get("student_ids", []):
        raise HTTPException(
            status_code=403,
            detail="You are not enrolled in this course.",
        )

    lec_count = await db.lectures.count_documents({"course_id": str(course["_id"])})
    t_user = await db.users.find_one({"_id": ObjectId(course["teacher_id"]) if ObjectId.is_valid(course["teacher_id"]) else course["teacher_id"]})
    
    course_data = serialize_doc(course)
    course_data["lecture_count"] = lec_count
    course_data["student_count"] = len(course.get("student_ids", []))
    course_data["teacher_name"] = t_user.get("name") if t_user else "Instructor"

    return course_data


@router.post("/enroll", response_model=CourseOut)
async def enroll_in_course(
    payload: CourseEnroll,
    student: dict = Depends(get_current_user),
):
    db = get_db()
    code = payload.code.strip().upper()
    course = await db.courses.find_one({"code": code})
    if not course:
        raise HTTPException(status_code=404, detail="Invalid course code. Course not found.")

    student_id = str(student["id"])
    if student_id not in course.get("student_ids", []):
        await db.courses.update_one(
            {"_id": course["_id"]},
            {"$addToSet": {"student_ids": student_id}}
        )
        course["student_ids"] = course.get("student_ids", []) + [student_id]

    course_data = serialize_doc(course)
    course_data["student_count"] = len(course.get("student_ids", []))
    return course_data

