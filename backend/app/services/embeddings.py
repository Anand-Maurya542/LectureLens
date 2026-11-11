import logging
from typing import Union
import numpy as np
from app.services.segmentation import get_embedding_model

logger = logging.getLogger("lecturelens.embeddings")


def generate_embedding(text: str) -> list[float]:
    """Generates a normalized 384-dimensional multilingual embedding for a single text.
    Safely handles model loading issues or memory limits without crashing.
    """
    if not text or not text.strip():
        return [0.0] * 384
    try:
        model = get_embedding_model()
        if model is None:
            return [0.0] * 384
        import torch
        with torch.no_grad():
            vec = model.encode(text, normalize_embeddings=True)
            return vec.tolist()
    except Exception as e:
        logger.warning(f"Failed to generate embedding for text: {e}")
        return [0.0] * 384


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generates normalized embeddings for a batch of texts safely."""
    if not texts:
        return []
    try:
        model = get_embedding_model()
        if model is None:
            return [[0.0] * 384 for _ in texts]
        import torch
        with torch.no_grad():
            vecs = model.encode(texts, normalize_embeddings=True)
            return vecs.tolist()
    except Exception as e:
        logger.warning(f"Failed to generate batch embeddings: {e}")
        return [[0.0] * 384 for _ in texts]


def compute_cosine_similarity(vec1: Union[list[float], np.ndarray], vec2: Union[list[float], np.ndarray]) -> float:
    """Computes cosine similarity between two unit-normalized vectors."""
    try:
        if not vec1 or not vec2:
            return 0.0
        a = np.array(vec1, dtype=np.float32)
        b = np.array(vec2, dtype=np.float32)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))
    except Exception:
        return 0.0

