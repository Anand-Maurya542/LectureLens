import logging
from typing import Optional
from app.database import get_db
from app.services.vector_search import search_chunks

logger = logging.getLogger("lecturelens.qa")

ABSTAIN_THRESHOLD = 0.28  # Calibrated cosine threshold; below this, question is considered out of context / insufficient evidence


async def answer_question(
    query: str,
    course_id: Optional[str] = None,
    lecture_id: Optional[str] = None,
    only_published: bool = True,
) -> dict:
    """Answers a student question strictly grounded in retrieved lecture chunks.
    Abstains if retrieved context is insufficient or ungrounded.
    """
    db = get_db()
    lecture_info = None
    if lecture_id:
        try:
            from bson import ObjectId
            lecture_info = await db.lectures.find_one({
                "_id": ObjectId(lecture_id) if ObjectId.is_valid(lecture_id) else lecture_id
            })
        except Exception:
            pass

    try:
        chunks = await search_chunks(
            query=query,
            course_id=course_id,
            lecture_id=lecture_id,
            search_mode="vector",
            top_k=3,
            only_published=only_published,
        )
    except Exception as e:
        logger.warning(f"Vector search failed in answer_question ({e}). Trying keyword search...")
        try:
            chunks = await search_chunks(
                query=query,
                course_id=course_id,
                lecture_id=lecture_id,
                search_mode="keyword",
                top_k=3,
                only_published=only_published,
            )
        except Exception:
            chunks = []

    best_score = chunks[0].get("score", 0.0) if chunks else 0.0

    if not chunks or best_score < ABSTAIN_THRESHOLD:
        lecture_title = lecture_info.get("title") if lecture_info else None
        topics_list = [t.get("title") for t in (lecture_info.get("topics") or []) if t.get("title")] if lecture_info else []

        if lecture_title:
            if topics_list:
                topics_str = ", ".join(f"'{t}'" for t in topics_list[:4])
                answer = (
                    f"This question (\"{query}\") is not covered in this lecture (\"{lecture_title}\"). "
                    f"This lecture focuses on {topics_str}. "
                    f"Please ask a question related to these course concepts."
                )
            else:
                answer = (
                    f"This question (\"{query}\") is not covered in the lecture \"{lecture_title}\". "
                    f"The available lecture materials do not contain sufficient evidence to answer this question reliably."
                )
        else:
            answer = "The available lecture materials do not contain sufficient evidence to answer this question reliably."

        return {
            "query": query,
            "answer": answer,
            "citations": [],
            "is_grounded": False,
            "confidence": 0.0,
        }

    # Extract supporting passages and citations
    citations = []
    passages = []

    for chunk in chunks:
        # Include chunks with positive relevance
        if chunk.get("score", 0.0) >= ABSTAIN_THRESHOLD * 0.75:
            citations.append({
                "lecture_id": chunk["lecture_id"],
                "lecture_title": chunk.get("lecture_title", "Lecture"),
                "topic_title": chunk.get("topic_title", "General"),
                "start": chunk.get("start", 0.0),
                "end": chunk.get("end", 0.0),
                "text": chunk.get("text", ""),
                "timestamp_url": chunk.get("timestamp_url"),
            })
            passages.append(chunk.get("text", "").strip())

    best_chunk = chunks[0]
    lecture_name = best_chunk.get("lecture_title", "the lecture")
    topic_name = best_chunk.get("topic_title", "General")

    # Clean and prioritize substantive passages for answer presentation
    valid_passages = [p for p in passages if len(p) > 15] or passages
    primary_passage = valid_passages[0] if valid_passages else ""

    answer_text = (
        f"Based on {lecture_name} (Section: {topic_name}):\n\n"
        f"{primary_passage.strip()}"
    )

    if len(valid_passages) > 1 and valid_passages[1] != primary_passage and len(valid_passages[1]) > 25:
        answer_text += f"\n\nAdditionally:\n{valid_passages[1].strip()}"

    confidence_score = max(0.0, min(1.0, float(best_score)))

    return {
        "query": query,
        "answer": answer_text,
        "citations": citations,
        "is_grounded": True,
        "confidence": round(confidence_score, 2),
    }

