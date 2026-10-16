import os
import tempfile
from pathlib import Path

from pydantic import BaseModel
from app.services.segmentation import segment_topics

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.services.transcription import transcribe_file

app = FastAPI(title="LectureLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm"
}

class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class SegmentationRequest(BaseModel):
    segments: list[TranscriptSegment]

@app.get("/")
def home():
    return {"message": "Welcome to LectureLens"}


@app.get("/health")
def health():
    return {"status": "ok"}

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
            detail="Unsupported file type. Upload audio or video."
        )

    temp_path = None

    try:
        # Temporary storage for this prototype.
        with tempfile.NamedTemporaryFile(
            suffix=extension, delete=False
        ) as temp_file:
            temp_path = temp_file.name

            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        if os.path.getsize(temp_path) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        result = transcribe_file(temp_path)

        return {
            "filename": filename,
            **result,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(exc)}"
        ) from exc

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)