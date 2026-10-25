import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from pydantic import BaseModel

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, db
from app.dependencies.auth import seed_default_users
from app.services.segmentation import segment_topics
from app.services.transcription import transcribe_file

# Routers
from app.routers.auth import router as auth_router
from app.routers.courses import router as courses_router
from app.routers.lectures import router as lectures_router
from app.routers.transcript import router as transcript_router
from app.routers.topics import router as topics_router
from app.routers.search import router as search_router
from app.routers.quizzes import router as quizzes_router
from app.routers.revision import router as revision_router
from app.routers.media import router as media_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("lecturelens.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup
    logger.info("Starting LectureLens API...")
    await connect_to_mongo()
    await seed_default_users()
    yield
    # Application shutdown
    logger.info("Shutting down LectureLens API...")
    await close_mongo_connection()


app = FastAPI(
    title="LectureLens API",
    description="Intelligent Lecture Transcription, Atlas Vector Search, and Personalized Learning Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS or ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular routers
app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(lectures_router)
app.include_router(transcript_router)
app.include_router(topics_router)
app.include_router(search_router)
app.include_router(quizzes_router)
app.include_router(revision_router)
app.include_router(media_router)

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm", ".ogg", ".flac"
}


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class SegmentationRequest(BaseModel):
    segments: list[TranscriptSegment]


# Baseline endpoints maintained for backward compatibility
@app.get("/")
def home():
    return {
        "message": "Welcome to LectureLens API",
        "database_connected": bool(db.db is not None),
        "database_mode": "mock_development" if db.is_mock else "mongodb_atlas",
        "docs_url": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "database_mode": "mock_development" if db.is_mock else "mongodb_atlas",
    }


@app.post("/segment")
def create_topics(payload: SegmentationRequest):
    segments = [
        segment.model_dump()
        for segment in payload.segments
    ]
    topics = segment_topics(segments)
    return {
        "topic_count": len(topics),
        "topics": topics,
    }


@app.post("/transcribe")
async def transcribe_lecture(file: UploadFile = File(...)):
    filename = file.filename or "lecture"
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload audio or video.",
        )

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=extension, delete=False
        ) as temp_file:
            temp_path = temp_file.name
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        if os.path.getsize(temp_path) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        result = transcribe_file(temp_path)
        return {
            "filename": filename,
            **result,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"Direct transcription failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(exc)}",
        ) from exc
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
