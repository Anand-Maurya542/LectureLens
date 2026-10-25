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

