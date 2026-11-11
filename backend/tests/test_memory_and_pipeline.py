import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import settings
from app.services.memory import get_current_rss_mb, get_peak_rss_mb, cleanup_memory
from app.services.transcription import get_model, unload_whisper_model, _whisper_model
from app.services.segmentation import get_embedding_model, unload_embedding_model
from app.services.pipeline import PIPELINE_SEMAPHORE, run_lecture_processing_pipeline
from app.database import get_db


@pytest.mark.asyncio
async def test_memory_service_and_health_endpoint():
    """Verifies memory measurement functions and /health memory reporting."""
    rss = get_current_rss_mb()
    peak = get_peak_rss_mb()
    assert rss > 0.0
    assert peak >= rss

    # Clean memory
    cleaned_rss = cleanup_memory("test_cleanup")
    assert cleaned_rss > 0.0

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "memory" in data
        assert data["memory"]["current_rss_mb"] > 0
        assert data["memory"]["peak_rss_mb"] > 0


@pytest.mark.asyncio
async def test_lazy_loading_and_unloading_whisper_model():
    """Verifies that Faster-Whisper is loaded lazily and can be unloaded completely."""
    # Ensure starting clean
    unload_whisper_model()
    from app.services import transcription
    assert transcription._whisper_model is None

    # Load model
    model = get_model()
    assert model is not None
    assert transcription._whisper_model is not None

    # Unload model
    unload_whisper_model()
    assert transcription._whisper_model is None


@pytest.mark.asyncio
async def test_lazy_loading_and_unloading_embedding_model():
    """Verifies that SentenceTransformer is loaded lazily and can be unloaded completely."""
    unload_embedding_model()
    from app.services import segmentation
    assert segmentation._embedding_model is None

    # Load model
    emb_model = get_embedding_model()
    assert emb_model is not None
    assert segmentation._embedding_model is not None

    # Unload model
    unload_embedding_model()
    assert segmentation._embedding_model is None


@pytest.mark.asyncio
async def test_pipeline_semaphore_and_error_handling():
    """Verifies that pipeline semaphore limits concurrency and handles errors without crashing."""
    assert PIPELINE_SEMAPHORE._value <= settings.MAX_CONCURRENT_PIPELINE_JOBS

    # Test handling of non-existent lecture safely
    fake_lecture_id = "60f1b2c3d4e5f6a7b8c9d0e1"
    # Should not raise any unhandled exception or crash
    await run_lecture_processing_pipeline(fake_lecture_id, media_path="non_existent.mp4")
