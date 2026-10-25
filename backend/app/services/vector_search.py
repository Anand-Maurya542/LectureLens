import logging
import re
from typing import Optional
from app.config import settings
from app.database import get_db, serialize_list
from app.services.embeddings import compute_cosine_similarity, generate_embedding, generate_embeddings_batch

logger = logging.getLogger("lecturelens.vector_search")


async def index_lecture_chunks(
    lecture_id: str,
    course_id: str,
    topics: list[dict],
    is_published: bool = False,
) -> int:
    """Builds search chunks from lecture topics and transcript segments,
    generates 384-d embeddings, and saves them to `lecture_chunks` collection.
    """
    db = get_db()
    # Remove existing chunks for this lecture to ensure freshness
    await db.lecture_chunks.delete_many({"lecture_id": lecture_id})

    chunks_to_create = []
    chunk_index = 0

    for topic in topics:
        topic_id = topic.get("topic_id", 1)
        topic_title = topic.get("title", "")
        segments = topic.get("segments", [])
        if not segments:
            continue

        # Group 2-3 segments per chunk to ensure adequate context window
        window_size = 3
        for i in range(0, len(segments), 2):
            window = segments[i : i + window_size]
            if not window:
                continue
            chunk_text = " ".join(s.get("text", "").strip() for s in window if s.get("text"))
            if not chunk_text:
                continue

            chunks_to_create.append({
                "lecture_id": str(lecture_id),
                "course_id": str(course_id),
                "topic_id": topic_id,
                "topic_title": topic_title,
                "chunk_index": chunk_index,
                "start": window[0]["start"],
                "end": window[-1]["end"],
                "text": chunk_text,
                "embedding_model": settings.EMBEDDING_MODEL_NAME,
                "embedding_dim": settings.EMBEDDING_DIMENSION,
                "is_published": is_published,
            })
            chunk_index += 1

    if not chunks_to_create:
        return 0

    # Batch compute embeddings
    texts = [c["text"] for c in chunks_to_create]
    embeddings = generate_embeddings_batch(texts)
    for chunk, emb in zip(chunks_to_create, embeddings):
        chunk["embedding"] = emb

    await db.lecture_chunks.insert_many(chunks_to_create)
    logger.info(f"Indexed {len(chunks_to_create)} semantic chunks for lecture {lecture_id}")
    return len(chunks_to_create)


async def execute_atlas_vector_search(
    query_vector: list[float],
    filter_dict: dict,
    top_k: int = 5,
) -> list[dict]:
    """Executes a MongoDB Atlas Vector Search query ($vectorSearch aggregation stage)
    if running against a live MongoDB Atlas cluster with the vector index created.
    Falls back to local cosine calculation if mock or standard cluster.
    """
    db = get_db()
    
    # Check if running against live Atlas
    try:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": settings.ATLAS_VECTOR_INDEX_NAME,
                    "path": "embedding",
                    "queryVector": query_vector,
                    "numCandidates": max(top_k * 10, 20),
                    "limit": top_k,
                    "filter": filter_dict if filter_dict else {},
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "lecture_id": 1,
                    "course_id": 1,
                    "topic_id": 1,
                    "topic_title": 1,
                    "start": 1,
                    "end": 1,
                    "text": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            }
        ]
        cursor = db.lecture_chunks.aggregate(pipeline)
        results = await cursor.to_list(length=top_k)
        if results:
            for r in results:
                r["search_mode"] = "atlas_vector_search"
            return serialize_list(results)
    except Exception as e:
        logger.info(
            f"Atlas $vectorSearch stage not available ({e}). Using local in-memory cosine fallback for semantic search."
        )

    # Local fallback: compute cosine similarity over matching chunks
    cursor = db.lecture_chunks.find(filter_dict)
    candidates = await cursor.to_list(length=200)
    scored = []
    for cand in candidates:
        emb = cand.get("embedding")
        if emb:
            sim = compute_cosine_similarity(query_vector, emb)
            cand["score"] = round(sim, 4)
            cand["search_mode"] = "vector (development-cosine)"
            scored.append(cand)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return serialize_list(scored[:top_k])


async def execute_keyword_search(
    query: str,
    filter_dict: dict,
    top_k: int = 5,
) -> list[dict]:
    """Performs keyword lexical retrieval over chunks matching query terms."""
    db = get_db()
    terms = [re.escape(t.strip().lower()) for t in query.split() if len(t.strip()) > 1]
    if not terms:
        terms = [re.escape(query.strip().lower())]

    pattern = "|".join(terms)
    query_filter = dict(filter_dict)
    query_filter["text"] = {"$regex": pattern, "$options": "i"}

    cursor = db.lecture_chunks.find(query_filter)
    candidates = await cursor.to_list(length=100)

    # Score by frequency of term occurrences
    scored = []
    for cand in candidates:
        text_lower = cand.get("text", "").lower()
        matches = sum(text_lower.count(t.lower()) for t in query.split() if len(t) > 1)
        cand["score"] = round(min(1.0, 0.2 * matches + 0.1), 3)
        cand["search_mode"] = "keyword"
        scored.append(cand)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return serialize_list(scored[:top_k])


async def search_chunks(
    query: str,
    course_id: Optional[str] = None,
    lecture_id: Optional[str] = None,
    search_mode: str = "vector",
    top_k: int = 5,
    only_published: bool = True,
) -> list[dict]:
    """Central search engine supporting Vector, Keyword, and Hybrid retrieval."""
    filter_dict = {}
    if only_published:
        filter_dict["is_published"] = True
    if course_id:
        filter_dict["course_id"] = str(course_id)
    if lecture_id:
        filter_dict["lecture_id"] = str(lecture_id)

    db = get_db()
    
    if search_mode == "keyword":
        raw_results = await execute_keyword_search(query, filter_dict, top_k)
    elif search_mode == "hybrid":
        # Hybrid combines Vector and Keyword via Reciprocal Rank Fusion (RRF)
        query_vec = generate_embedding(query)
        vec_results = await execute_atlas_vector_search(query_vec, filter_dict, top_k * 2)
        kw_results = await execute_keyword_search(query, filter_dict, top_k * 2)

        rrf_scores = {}
        item_map = {}
        k_const = 60

        for rank, item in enumerate(vec_results, start=1):
            cid = item["id"]
            item_map[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k_const + rank))

        for rank, item in enumerate(kw_results, start=1):
            cid = item["id"]
            item_map[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (k_const + rank))

        combined = []
        for cid, score in sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]:
            it = item_map[cid]
            it["score"] = round(score * 10, 4)
            it["search_mode"] = "hybrid (vector+keyword)"
            combined.append(it)
        raw_results = combined
    else:
        # Default: vector search
        query_vec = generate_embedding(query)
        raw_results = await execute_atlas_vector_search(query_vec, filter_dict, top_k)

    # Hydrate with lecture and course titles and timestamp links
    results = []
    for item in raw_results:
        lec = await db.lectures.find_one({"_id": item["lecture_id"]})
        if not lec:
            from bson import ObjectId
            try:
                lec = await db.lectures.find_one({"_id": ObjectId(item["lecture_id"])})
            except Exception:
                pass
        
        lecture_title = lec.get("title", "Lecture") if lec else "Lecture"
        source_type = lec.get("source_type", "upload") if lec else "upload"
        youtube_url = lec.get("youtube_url") if lec else None
        start_sec = item.get("start", 0.0)

        # Generate timestamp deep-link
        timestamp_url = None
        if source_type == "youtube" and youtube_url:
            sec_int = int(start_sec)
            delim = "&" if "?" in youtube_url else "?"
            timestamp_url = f"{youtube_url}{delim}t={sec_int}s"
        else:
            timestamp_url = f"/lectures/{item['lecture_id']}?t={start_sec}"

        results.append({
            "chunk_id": item["id"],
            "lecture_id": item["lecture_id"],
            "lecture_title": lecture_title,
            "course_id": item.get("course_id", ""),
            "topic_id": item.get("topic_id"),
            "topic_title": item.get("topic_title", ""),
            "start": item.get("start", 0.0),
            "end": item.get("end", 0.0),
            "text": item.get("text", ""),
            "score": item.get("score", 0.0),
            "search_mode": item.get("search_mode", search_mode),
            "timestamp_url": timestamp_url,
            "source_type": source_type,
        })

    return results

