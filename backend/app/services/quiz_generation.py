import datetime
import logging
import random
from typing import Optional
from bson import ObjectId
from app.database import get_db

logger = logging.getLogger("lecturelens.quiz_gen")


def generate_draft_quiz_questions(
    lecture_id: str,
    topics: list[dict],
    course_id: Optional[str] = None,
) -> list[dict]:
    """Generates candidate multiple-choice quiz questions from lecture topics.
    Crucially, all questions are marked with `is_approved = False` so they
    remain hidden from students until explicit teacher review.
    """
    drafts = []
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for topic in topics:
        topic_id = topic.get("topic_id", 1)
        topic_title = topic.get("title", "").strip()
        segments = topic.get("segments", [])
        
        valid_segments = [s for s in segments if len(s.get("text", "").split()) >= 6]
        if not valid_segments:
            continue

        # Create a concept identification question
        sample_seg = valid_segments[0]
        question_text = f"According to the lecture section on '{topic_title}', which of the following is emphasized?"
        correct_answer = sample_seg["text"].strip()
        
        # Form plausible distractors from other topics or fallback concepts
        distractors = [
            f"The opposite conclusion regarding {topic_title}.",
            "This concept is obsolete and not used in modern practice.",
            "It requires hardware acceleration without software support.",
        ]
        options = [correct_answer] + distractors
        random.shuffle(options)

        drafts.append({
            "lecture_id": str(lecture_id),
            "course_id": str(course_id) if course_id else "",
            "topic_id": topic_id,
            "question_type": "mcq",
            "question": question_text,
            "options": options,
            "correct_answer": correct_answer,
            "explanation": f"Refer to the lecture discussion around {sample_seg.get('start', 0.0)}s: '{sample_seg['text']}'",
            "difficulty": "medium",
            "is_approved": False,  # Teacher must approve!
            "created_at": now,
            "updated_at": now,
        })

        # If topic has multiple segments, generate a secondary factual question
        if len(valid_segments) >= 3:
            sec_seg = valid_segments[1]
            q2_text = f"In the context of {topic_title}, what statement accurately reflects the lecture content?"
            c2_answer = sec_seg["text"].strip()
            d2 = [
                "The algorithm does not converge under any conditions.",
                "It was discarded in favor of brute-force search.",
                "Data normalization has no impact on performance.",
            ]
            opts2 = [c2_answer] + d2
            random.shuffle(opts2)
            drafts.append({
                "lecture_id": str(lecture_id),
                "course_id": str(course_id) if course_id else "",
                "topic_id": topic_id,
                "question_type": "mcq",
                "question": q2_text,
                "options": opts2,
                "correct_answer": c2_answer,
                "explanation": f"Discussed at {sec_seg.get('start', 0.0)}s: '{sec_seg['text']}'",
                "difficulty": "easy",
                "is_approved": False,
                "created_at": now,
                "updated_at": now,
            })

    return drafts


async def save_draft_quizzes(
    lecture_id: str,
    topics: list[dict],
    course_id: Optional[str] = None,
    force: bool = False,
) -> int:
    """Generates and saves quiz drafts to database."""
    db = get_db()
    
    if not course_id:
        try:
            lec = await db.lectures.find_one(
                {"_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id}
            )
            if lec:
                course_id = str(lec.get("course_id", ""))
        except Exception:
            pass

    # Check if quizzes already exist for this lecture
    existing_count = await db.quizzes.count_documents({"lecture_id": str(lecture_id)})
    if existing_count > 0 and not force:
        return existing_count

    drafts = generate_draft_quiz_questions(lecture_id, topics, course_id=course_id)
    if drafts:
        if force and existing_count > 0:
            # Delete only unapproved draft quizzes, preserving any approved questions
            await db.quizzes.delete_many({"lecture_id": str(lecture_id), "is_approved": False})
        await db.quizzes.insert_many(drafts)
        logger.info(f"Generated {len(drafts)} draft quiz questions for lecture {lecture_id}")
        return len(drafts)

    return existing_count

