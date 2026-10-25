import logging
from functools import lru_cache
from typing import Optional
from sentence_transformers import SentenceTransformer
from app.config import settings

logger = logging.getLogger("lecturelens.segmentation")


@lru_cache(maxsize=1)
def get_embedding_model():
    logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME}")
    return SentenceTransformer(settings.EMBEDDING_MODEL_NAME, device="cpu")


def generate_topic_title(group: list[dict]) -> str:
    """Derives a descriptive title for a group of segments."""
    if not group:
        return "Untitled Section"
    first_text = group[0]["text"].strip()
    if len(first_text) <= 60:
        return first_text
    # Cut off cleanly at the nearest word boundary
    truncated = first_text[:60]
    last_space = truncated.rfind(" ")
    if last_space > 20:
        truncated = truncated[:last_space]
    return f"{truncated}..."


def segment_topics(
    segments: list[dict],
    similarity_threshold: float = 0.45,
    min_segments_per_topic: int = 3,
) -> list[dict]:
    """Segments transcript segments into coherent thematic topics using
    multilingual transformer sentence embeddings and cosine thresholding.
    """
    # Remove empty transcript segments
    valid_segments = [
        segment for segment in segments
        if segment.get("text", "").strip()
    ]

    if not valid_segments:
        return []

    if len(valid_segments) <= 2:
        return [{
            "topic_id": 1,
            "title": generate_topic_title(valid_segments),
            "start": valid_segments[0]["start"],
            "end": valid_segments[-1]["end"],
            "segments": valid_segments,
            "is_edited": False,
        }]

    model = get_embedding_model()
    texts = [s["text"] for s in valid_segments]
    embeddings = model.encode(texts, normalize_embeddings=True)

    groups = []
    current_group = [valid_segments[0]]

    for i in range(1, len(valid_segments)):
        # Dot product of normalized vectors = cosine similarity
        similarity = float(embeddings[i - 1] @ embeddings[i])

        should_split = (
            similarity < similarity_threshold
            and len(current_group) >= min_segments_per_topic
        )

        if should_split:
            groups.append(current_group)
            current_group = []

        current_group.append(valid_segments[i])

    if current_group:
        groups.append(current_group)

    topics = []
    for index, group in enumerate(groups, start=1):
        topics.append({
            "topic_id": index,
            "title": generate_topic_title(group),
            "start": group[0]["start"],
            "end": group[-1]["end"],
            "segments": group,
            "is_edited": False,
        })

    return topics


def baseline_fixed_window_segmentation(
    segments: list[dict],
    window_duration_seconds: float = 300.0,  # 5-minute fixed windows
) -> list[dict]:
    """Baseline rule-based segmentation dividing lecture by fixed time intervals."""
    if not segments:
        return []

    topics = []
    current_group = []
    topic_index = 1
    window_start = segments[0]["start"]

    for seg in segments:
        if (seg["end"] - window_start) > window_duration_seconds and current_group:
            topics.append({
                "topic_id": topic_index,
                "title": f"Section {topic_index} ({int(window_start // 60)}m - {int(seg['start'] // 60)}m)",
                "start": current_group[0]["start"],
                "end": current_group[-1]["end"],
                "segments": current_group,
                "is_edited": False,
            })
            topic_index += 1
            current_group = []
            window_start = seg["start"]
        current_group.append(seg)

    if current_group:
        topics.append({
            "topic_id": topic_index,
            "title": f"Section {topic_index} ({int(window_start // 60)}m - {int(current_group[-1]['end'] // 60)}m)",
            "start": current_group[0]["start"],
            "end": current_group[-1]["end"],
            "segments": current_group,
            "is_edited": False,
        })

    return topics
