from functools import lru_cache
from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_embedding_model():
    return SentenceTransformer(
        "paraphrase-multilingual-MiniLM-L12-v2"
    )


def segment_topics(
    segments: list[dict],
    similarity_threshold: float = 0.45,
) -> list[dict]:
    # Remove empty transcript segments.
    segments = [
        segment for segment in segments
        if segment.get("text", "").strip()
    ]

    if not segments:
        return []

    if len(segments) == 1:
        groups = [segments]
    else:
        model = get_embedding_model()

        texts = [segment["text"] for segment in segments]

        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
        )

        groups = []
        current_group = [segments[0]]

        for i in range(1, len(segments)):
            # Normalised embeddings let us use dot product
            # as cosine similarity.
            similarity = float(
                embeddings[i - 1] @ embeddings[i]
            )

            # Avoid creating very short topics.
            should_split = (
                similarity < similarity_threshold
                and len(current_group) >= 3
            )

            if should_split:
                groups.append(current_group)
                current_group = []

            current_group.append(segments[i])

        if current_group:
            groups.append(current_group)

    topics = []

    for index, group in enumerate(groups, start=1):
        topics.append({
            "topic_id": index,
            "title": group[0]["text"][:70],
            "start": group[0]["start"],
            "end": group[-1]["end"],
            "segments": group,
        })

    return topics