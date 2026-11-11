import logging
from typing import Optional
from app.services.vector_search import search_chunks

logger = logging.getLogger("lecturelens.qa")

ABSTAIN_THRESHOLD = 0.30  # Below this similarity, declare insufficient evidence


async def answer_question(
    query: str,
    course_id: Optional[str] = None,
    lecture_id: Optional[str] = None,
    only_published: bool = True,
) -> dict:
    """Answers a student question strictly grounded in retrieved lecture chunks.
    Abstains if retrieved context is insufficient or ungrounded.
    """
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

    if not chunks or chunks[0].get("score", 0.0) < ABSTAIN_THRESHOLD:
        return {
            "query": query,
            "answer": "The available lecture materials do not contain sufficient evidence to answer this question reliably.",
            "citations": [],
            "is_grounded": False,
            "confidence": 0.0,
        }

    # Extract supporting passages and citations
    citations = []
    passages = []

    for chunk in chunks:
        citations.append({
            "lecture_id": chunk["lecture_id"],
            "lecture_title": chunk.get("lecture_title", "Lecture"),
            "topic_title": chunk.get("topic_title", "General"),
            "start": chunk.get("start", 0.0),
            "end": chunk.get("end", 0.0),
            "text": chunk.get("text", ""),
            "timestamp_url": chunk.get("timestamp_url"),
        })
        passages.append(chunk.get("text", ""))

    # Synthesize a grounded answer based on the best matching evidence
    primary_passage = passages[0] if passages else ""
    best_chunk = chunks[0]
    
    # Grounded synthesis: provide direct context with citation marker
    answer_text = (
        f"Based on {best_chunk.get('lecture_title', 'the lecture')} (Section: {best_chunk.get('topic_title', 'General')}): "
        f"{primary_passage.strip()}"
    )

    if len(passages) > 1 and len(passages[1]) > 20:
        answer_text += f"\n\nAdditionally: {passages[1].strip()}"

    return {
        "query": query,
        "answer": answer_text,
        "citations": citations,
        "is_grounded": True,
        "confidence": float(best_chunk.get("score", 0.8)),
    }

