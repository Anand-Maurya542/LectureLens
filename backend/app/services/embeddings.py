import logging
from typing import Union
import numpy as np
from app.services.segmentation import get_embedding_model

logger = logging.getLogger("lecturelens.embeddings")


def generate_embedding(text: str) -> list[float]:
    """Generates a normalized 384-dimensional multilingual embedding for a single text."""
    model = get_embedding_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generates normalized embeddings for a batch of texts."""
    if not texts:
        return []
    model = get_embedding_model()
    vecs = model.encode(texts, normalize_embeddings=True)
    return vecs.tolist()


def compute_cosine_similarity(vec1: Union[list[float], np.ndarray], vec2: Union[list[float], np.ndarray]) -> float:
    """Computes cosine similarity between two unit-normalized vectors."""
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

