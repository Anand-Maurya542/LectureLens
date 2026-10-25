import logging
from bson import ObjectId
from app.database import get_db

logger = logging.getLogger("lecturelens.revision")


async def generate_student_revision_recommendations(
    student_id: str,
    course_id: str = None,
) -> list[dict]:
    """Generates transparent, rule-based personalized revision recommendations
    by analyzing student's quiz attempts and identifying topics with errors.
    """
    db = get_db()
    
    # Fetch student attempts
    query = {"student_id": str(student_id)}
    cursor = db.quiz_attempts.find(query).sort("created_at", -1)
    attempts = await cursor.to_list(length=100)

    if not attempts:
        # If no quiz attempts yet, recommend foundational topics from published lectures
        lec_query = {"is_published": True}
        if course_id:
            lec_query["course_id"] = str(course_id)
        
        sample_lecs = await db.lectures.find(lec_query).to_list(length=3)
        recs = []
        for lec in sample_lecs:
            topics = lec.get("topics", [])
            if topics:
                first_topic = topics[0]
                recs.append({
                    "topic_id": first_topic.get("topic_id", 1),
                    "topic_title": first_topic.get("title", "Foundational Concepts"),
                    "lecture_id": str(lec["_id"]),
                    "lecture_title": lec.get("title", "Lecture"),
                    "course_id": str(lec.get("course_id", "")),
                    "weakness_score": 0.5,
                    "reason": "Initial study recommendation: No quizzes attempted yet for this topic.",
                    "suggested_start_time": first_topic.get("start", 0.0),
                    "summary_snippet": first_topic.get("title", ""),
                    "timestamp_url": f"/lectures/{lec['_id']}?t={first_topic.get('start', 0.0)}",
                })
        return recs

    # Aggregate performance by (lecture_id, topic_id)
    topic_stats = {}  # key: (lecture_id, topic_id) -> {"total": int, "incorrect": int}

    for attempt in attempts:
        results = attempt.get("results", [])
        lec_id = attempt.get("lecture_id")
        for res in results:
            t_id = res.get("topic_id")
            if not t_id or not lec_id:
                continue
            key = (str(lec_id), int(t_id))
            if key not in topic_stats:
                topic_stats[key] = {"total": 0, "incorrect": 0}
            topic_stats[key]["total"] += 1
            if not res.get("is_correct", False):
                topic_stats[key]["incorrect"] += 1

    # Filter for weak topics (error rate >= 33%)
    recommendations = []

    for (lec_id, t_id), stats in topic_stats.items():
        if stats["total"] == 0:
            continue
        error_rate = stats["incorrect"] / stats["total"]
        if error_rate > 0.0 or stats["total"] < 2:
            # Fetch lecture details
            lec = None
            try:
                lec = await db.lectures.find_one({"_id": ObjectId(lec_id)})
            except Exception:
                pass
            if not lec:
                lec = await db.lectures.find_one({"_id": lec_id})

            if not lec or not lec.get("is_published", False):
                continue

            # Find topic title and timestamp
            topic_title = f"Topic {t_id}"
            start_time = 0.0
            for top in lec.get("topics", []):
                if top.get("topic_id") == t_id:
                    topic_title = top.get("title", topic_title)
                    start_time = top.get("start", 0.0)
                    break

            reason_desc = (
                f"You missed {stats['incorrect']} out of {stats['total']} quiz question(s) "
                f"on this concept ({int(error_rate * 100)}% error rate)."
            )

            recommendations.append({
                "topic_id": t_id,
                "topic_title": topic_title,
                "lecture_id": lec_id,
                "lecture_title": lec.get("title", "Lecture"),
                "course_id": str(lec.get("course_id", "")),
                "weakness_score": round(error_rate, 2),
                "reason": reason_desc,
                "suggested_start_time": start_time,
                "summary_snippet": topic_title,
                "timestamp_url": f"/lectures/{lec_id}?t={start_time}",
            })

    # Sort by weakness score descending
    recommendations.sort(key=lambda x: x["weakness_score"], reverse=True)
    return recommendations[:5]

