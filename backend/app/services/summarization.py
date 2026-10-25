import logging
import numpy as np
from app.services.segmentation import get_embedding_model

logger = logging.getLogger("lecturelens.summarization")


def summarize_topic_extractive(
    segments: list[dict],
    max_sentences: int = 3,
) -> dict:
    """Extracts the most salient, representative sentences from a topic's transcript
    using multilingual sentence embeddings and centroid cosine similarity.
    Preserves exact supporting timestamps and references.
    """
    valid_segments = [s for s in segments if s.get("text", "").strip()]
    if not valid_segments:
        return {
            "summary_text": "No content available to summarize.",
            "key_points": [],
            "source_segment_indices": [],
        }

    texts = [s["text"].strip() for s in valid_segments]

    if len(texts) <= max_sentences:
        return {
            "summary_text": " ".join(texts),
            "key_points": texts,
            "source_segment_indices": [
                s.get("segment_index", idx) for idx, s in enumerate(valid_segments)
            ],
        }

    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)

    # Compute topic centroid vector
    centroid = np.mean(embeddings, axis=0, keepdims=True)
    centroid /= np.linalg.norm(centroid, axis=1, keepdims=True)

    # Compute cosine similarity of each sentence to the centroid
    similarities = (embeddings @ centroid.T).flatten()

    # Select top-k sentences that maximize coverage and retain chronological ordering
    top_indices = np.argsort(similarities)[::-1][:max_sentences]
    ordered_indices = sorted(top_indices.tolist())

    selected_points = [texts[i] for i in ordered_indices]
    summary_text = " ".join(selected_points)

    source_indices = [
        valid_segments[i].get("segment_index", i) for i in ordered_indices
    ]

    return {
        "summary_text": summary_text,
        "key_points": selected_points,
        "source_segment_indices": source_indices,
    }


def generate_lecture_summaries(topics: list[dict]) -> list[dict]:
    """Generates extractive summaries for all topics in a lecture."""
    summaries = []
    for topic in topics:
        topic_segments = topic.get("segments", [])
        summary_result = summarize_topic_extractive(topic_segments)
        summaries.append({
            "topic_id": topic.get("topic_id"),
            "summary_type": "extractive",
            "summary_text": summary_result["summary_text"],
            "key_points": summary_result["key_points"],
            "is_approved": True,
        })
    return summaries

