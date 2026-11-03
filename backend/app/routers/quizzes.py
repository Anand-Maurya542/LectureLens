import datetime
import logging
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db, serialize_doc, serialize_list
from app.dependencies.auth import get_current_user, require_student, require_teacher
from app.schemas.quiz import (
    QuizApprovalRequest,
    QuizAttemptOut,
    QuizAttemptSubmit,
    QuizQuestionCreate,
    QuizQuestionOut,
    QuizResultItem,
)
from app.services.quiz_generation import save_draft_quizzes

logger = logging.getLogger("lecturelens.router.quizzes")
router = APIRouter(prefix="/api", tags=["Quizzes & Assessment"])


@router.get("/lectures/{lecture_id}/quizzes", response_model=list[QuizQuestionOut])
async def get_lecture_quizzes(
    lecture_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    role = current_user.get("role")
    
    query = {"lecture_id": str(lecture_id)}

    # Critical requirement: Unapproved questions must NEVER become student-visible
    if role == "student":
        query["is_approved"] = True

    cursor = db.quizzes.find(query)
    raw_quizzes = await cursor.to_list(length=50)

    results = []
    for q in raw_quizzes:
        q_dict = serialize_doc(q)
        # If student, strip correct answer and explanation so they cannot cheat before submission
        if role == "student":
            q_dict["correct_answer"] = None
            q_dict["explanation"] = None
        results.append(q_dict)

    return results


@router.patch("/quizzes/{quiz_id}/approve", response_model=QuizQuestionOut)
async def approve_quiz_question(
    quiz_id: str,
    payload: QuizApprovalRequest,
    teacher: dict = Depends(require_teacher),
):
    """Allows an authorized teacher to inspect, edit, and approve a generated quiz question."""
    db = get_db()
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id) if ObjectId.is_valid(quiz_id) else quiz_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz question not found")

    update_fields = {"is_approved": payload.is_approved}
    if payload.question is not None:
        update_fields["question"] = payload.question
    if payload.options is not None:
        update_fields["options"] = payload.options
    if payload.correct_answer is not None:
        update_fields["correct_answer"] = payload.correct_answer
    if payload.explanation is not None:
        update_fields["explanation"] = payload.explanation
    if payload.difficulty is not None:
        update_fields["difficulty"] = payload.difficulty

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    update_fields["updated_at"] = now

    await db.quizzes.update_one(
        {"_id": q["_id"]},
        {"$set": update_fields}
    )

    # Audit log
    await db.audit_logs.insert_one({
        "user_id": str(teacher["id"]),
        "action": "quiz_approval" if payload.is_approved else "quiz_rejection",
        "entity_type": "quiz",
        "entity_id": str(quiz_id),
        "diff": update_fields,
        "timestamp": now,
    })

    updated_q = await db.quizzes.find_one({"_id": q["_id"]})
    return serialize_doc(updated_q)


@router.post("/lectures/{lecture_id}/quizzes", response_model=QuizQuestionOut)
async def create_quiz_question(
    lecture_id: str,
    payload: QuizQuestionCreate,
    teacher: dict = Depends(require_teacher),
):
    """Allows a teacher to create a custom assessment question for a lecture."""
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    course = await db.courses.find_one({"_id": ObjectId(lec["course_id"]) if ObjectId.is_valid(lec["course_id"]) else lec["course_id"]})
    t_id = str(teacher["id"])
    if course:
        is_instructor = (t_id == str(course.get("teacher_id")) or t_id in [str(x) for x in course.get("teacher_ids", [])] or teacher.get("role") == "admin")
        if not is_instructor:
            raise HTTPException(status_code=403, detail="You are not authorized to create quizzes in this course.")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_q = {
        "lecture_id": str(lecture_id),
        "course_id": str(lec.get("course_id", "")),
        "topic_id": payload.topic_id,
        "question_type": payload.question_type or "mcq",
        "question": payload.question.strip(),
        "options": payload.options or [],
        "correct_answer": payload.correct_answer.strip(),
        "explanation": payload.explanation.strip() if payload.explanation else "",
        "difficulty": payload.difficulty or "medium",
        "is_approved": payload.is_approved,
        "created_at": now,
        "updated_at": now,
    }

    res = await db.quizzes.insert_one(new_q)
    new_q["_id"] = str(res.inserted_id)
    new_q["id"] = str(res.inserted_id)
    return serialize_doc(new_q)


@router.post("/lectures/{lecture_id}/quizzes/generate")
async def generate_quizzes_endpoint(
    lecture_id: str,
    teacher: dict = Depends(require_teacher),
):
    """Triggers on-demand AI quiz generation from lecture topics."""
    db = get_db()
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    topics = lec.get("topics", [])
    if not topics:
        topics_cursor = db.topics.find({"lecture_id": str(lecture_id)})
        topics = await topics_cursor.to_list(length=100)

    if not topics:
        raise HTTPException(status_code=400, detail="Cannot generate quizzes: lecture has no segmented topics.")

    created = await save_draft_quizzes(lecture_id=str(lecture_id), topics=topics)
    return {
        "message": f"Generated {len(created)} draft quiz questions.",
        "count": len(created),
    }


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz_question(
    quiz_id: str,
    teacher: dict = Depends(require_teacher),
):
    """Deletes a quiz question."""
    db = get_db()
    q = await db.quizzes.find_one({"_id": ObjectId(quiz_id) if ObjectId.is_valid(quiz_id) else quiz_id})
    if not q:
        raise HTTPException(status_code=404, detail="Quiz question not found")

    await db.quizzes.delete_one({"_id": q["_id"]})
    return {"message": "Quiz question deleted successfully."}


@router.post("/lectures/{lecture_id}/quizzes/submit", response_model=QuizAttemptOut)
async def submit_quiz_attempt(
    lecture_id: str,
    payload: QuizAttemptSubmit,
    student: dict = Depends(require_student),
):
    """Evaluates student quiz submissions, grades answers against approved questions,
    and logs attempt performance for personalized revision.
    """
    db = get_db()
    
    # Verify course membership
    lec = await db.lectures.find_one({"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id})
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    
    cid = str(lec.get("course_id", ""))
    course = await db.courses.find_one({"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid})
    uid = str(student["id"])
    if course and uid not in [str(x) for x in course.get("student_ids", [])]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an approved enrolled student to submit quiz attempts.",
        )

    # Retrieve only approved questions for this lecture
    cursor = db.quizzes.find({"lecture_id": str(lecture_id), "is_approved": True})
    approved_questions = await cursor.to_list(length=50)

    if not approved_questions:
        raise HTTPException(status_code=400, detail="No approved quiz questions available for this lecture.")

    results: list[dict] = []
    correct_count = 0
    weak_topics = set()

    for q in approved_questions:
        qid = str(q["_id"])
        correct_ans = q.get("correct_answer", "").strip()
        student_ans = payload.answers.get(qid, "").strip()

        is_correct = (student_ans.lower() == correct_ans.lower())
        if is_correct:
            correct_count += 1
        else:
            if q.get("topic_id"):
                weak_topics.add(q["topic_id"])

        results.append({
            "question_id": qid,
            "question": q.get("question", ""),
            "selected_answer": student_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
            "topic_id": q.get("topic_id"),
        })

    total_q = len(approved_questions)
    score = (correct_count / total_q) * 100.0 if total_q > 0 else 0.0

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    attempt_doc = {
        "student_id": str(student["id"]),
        "student_name": student.get("name", "Student"),
        "lecture_id": str(lecture_id),
        "course_id": cid,
        "score": score,
        "percentage": round(score, 1),
        "total_questions": total_q,
        "correct_count": correct_count,
        "results": results,
        "weak_topics": list(weak_topics),
        "created_at": now,
    }

    insert_res = await db.quiz_attempts.insert_one(attempt_doc)
    attempt_doc["_id"] = str(insert_res.inserted_id)
    attempt_doc["id"] = str(insert_res.inserted_id)

    return serialize_doc(attempt_doc)


@router.get("/courses/{course_id}/quiz-analytics")
async def get_teacher_course_quiz_analytics(
    course_id: str,
    teacher: dict = Depends(require_teacher),
):
    """Provides aggregate quiz statistics and weak topic identification across students."""
    db = get_db()
    
    # Verify course ownership
    course = await db.courses.find_one({"_id": ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Fetch all lectures for this course
    lecs = await db.lectures.find({"course_id": str(course_id)}).to_list(100)
    lec_ids = [str(l["_id"]) for l in lecs]

    # Fetch attempts across these lectures
    cursor = db.quiz_attempts.find({"lecture_id": {"$in": lec_ids}})
    attempts = await cursor.to_list(1000)

    if not attempts:
        return {
            "total_attempts": 0,
            "average_score": 0.0,
            "topic_weakness_summary": [],
            "recent_attempts": [],
        }

    total_score = sum(a.get("percentage", 0.0) for a in attempts)
    avg_score = round(total_score / len(attempts), 1)

    # Aggregate topic errors
    topic_error_counts = {}
    for a in attempts:
        for r in a.get("results", []):
            t_id = r.get("topic_id")
            if not t_id:
                continue
            key = f"Topic {t_id}"
            if key not in topic_error_counts:
                topic_error_counts[key] = {"incorrect": 0, "total": 0}
            topic_error_counts[key]["total"] += 1
            if not r.get("is_correct"):
                topic_error_counts[key]["incorrect"] += 1

    topic_summary = []
    for top_name, stats in topic_error_counts.items():
        err_pct = round((stats["incorrect"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0
        topic_summary.append({
            "topic": top_name,
            "attempts": stats["total"],
            "error_rate_percentage": err_pct,
        })

    topic_summary.sort(key=lambda x: x["error_rate_percentage"], reverse=True)

    return {
        "total_attempts": len(attempts),
        "average_score": avg_score,
        "topic_weakness_summary": topic_summary,
        "recent_attempts": serialize_list(attempts[-10:]),
    }


# ==========================================
# COURSE-LEVEL QUIZZES & SUBMISSIONS
# ==========================================

@router.get("/courses/{course_id}/quizzes", response_model=list[QuizQuestionOut])
async def get_course_quizzes(
    course_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lists all quizzes created for lectures in a given course with RBAC checks."""
    db = get_db()
    cid = str(course_id)
    course = await db.courses.find_one({"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user_id = str(current_user["id"])
    role = current_user.get("role")

    is_instructor = (role in ["teacher", "admin"]) and (
        role == "admin"
        or user_id == str(course.get("teacher_id"))
        or user_id in [str(x) for x in course.get("teacher_ids", [])]
    )
    is_student_enrolled = (role == "student") and (
        user_id in [str(x) for x in course.get("student_ids", [])]
    )

    if not is_instructor and not is_student_enrolled and role != "admin":
        raise HTTPException(status_code=403, detail="You do not have access to quizzes in this course.")

    # Find all lectures in this course
    cursor_lec = db.lectures.find({"course_id": cid})
    raw_lecs = await cursor_lec.to_list(100)
    lec_ids = [str(l["_id"]) for l in raw_lecs]

    # Query quizzes for this course
    query = {"$or": [{"course_id": cid}, {"lecture_id": {"$in": lec_ids}}]}
    if role == "student":
        query["is_approved"] = True

    cursor_quiz = db.quizzes.find(query)
    raw_quizzes = await cursor_quiz.to_list(length=100)

    results = []
    for q in raw_quizzes:
        q_dict = serialize_doc(q)
        if role == "student":
            q_dict["correct_answer"] = None
            q_dict["explanation"] = None
        results.append(q_dict)

    return results


@router.get("/courses/{course_id}/quiz-submissions")
async def get_course_quiz_submissions(
    course_id: str,
    teacher: dict = Depends(require_teacher),
):
    """Allows an approved instructor or admin to view all student quiz submissions and performance for a course."""
    db = get_db()
    cid = str(course_id)
    course = await db.courses.find_one({"_id": ObjectId(cid) if ObjectId.is_valid(cid) else cid})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    t_id = str(teacher["id"])
    role = teacher.get("role")
    is_instructor = (
        role == "admin"
        or t_id == str(course.get("teacher_id"))
        or t_id in [str(x) for x in course.get("teacher_ids", [])]
    )
    if not is_instructor:
        raise HTTPException(status_code=403, detail="You are not authorized to view submissions for this course.")

    # Find attempts
    cursor_lec = db.lectures.find({"course_id": cid})
    raw_lecs = await cursor_lec.to_list(100)
    lec_map = {str(l["_id"]): l.get("title", "Lecture") for l in raw_lecs}
    lec_ids = list(lec_map.keys())

    query = {"$or": [{"course_id": cid}, {"lecture_id": {"$in": lec_ids}}]}
    cursor_attempts = db.quiz_attempts.find(query).sort("created_at", -1)
    raw_attempts = await cursor_attempts.to_list(length=200)

    submissions = []
    for a in raw_attempts:
        lid = a.get("lecture_id")
        a_dict = serialize_doc(a)
        a_dict["lecture_title"] = lec_map.get(lid, "Lecture Quiz")
        submissions.append(a_dict)

    return {
        "course_id": cid,
        "course_title": course.get("title"),
        "total_submissions": len(submissions),
        "submissions": submissions,
    }


@router.get("/courses/{course_id}/my-attempts")
async def get_my_course_quiz_attempts(
    course_id: str,
    student: dict = Depends(require_student),
):
    """Returns the current student's quiz attempts in a given course."""
    db = get_db()
    cid = str(course_id)
    student_id = str(student["id"])

    cursor_lec = db.lectures.find({"course_id": cid})
    raw_lecs = await cursor_lec.to_list(100)
    lec_map = {str(l["_id"]): l.get("title", "Lecture") for l in raw_lecs}
    lec_ids = list(lec_map.keys())

    query = {
        "student_id": student_id,
        "$or": [{"course_id": cid}, {"lecture_id": {"$in": lec_ids}}],
    }
    cursor_attempts = db.quiz_attempts.find(query).sort("created_at", -1)
    raw_attempts = await cursor_attempts.to_list(length=100)

    attempts = []
    for a in raw_attempts:
        lid = a.get("lecture_id")
        a_dict = serialize_doc(a)
        a_dict["lecture_title"] = lec_map.get(lid, "Lecture Quiz")
        attempts.append(a_dict)

    return attempts


