import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ or project root
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
root_dir = backend_dir.parent

load_dotenv(backend_dir / ".env")
load_dotenv(root_dir / ".env")


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "lecturelens_dev_jwt_secret_key_change_in_production_32b"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )
    
    ALLOWED_ORIGINS: list[str] = [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,https://lecture-lens-five.vercel.app,https://lecturelens-five.vercel.app",
        ).split(",")
        if origin.strip()
    ]
    
    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "").strip()
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "lecturelens_db").strip()
    
    # Storage
    MEDIA_UPLOAD_DIR: Path = Path(os.getenv("MEDIA_UPLOAD_DIR", str(root_dir / "data" / "uploads")))
    
    # Vector Search
    ATLAS_VECTOR_INDEX_NAME: str = os.getenv("ATLAS_VECTOR_INDEX_NAME", "vector_index")
    EMBEDDING_MODEL_NAME: str = os.getenv(
        "EMBEDDING_MODEL_NAME", "paraphrase-multilingual-MiniLM-L12-v2"
    )
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "384"))
    
    # Whisper ASR & Processing Optimization
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    WHISPER_CPU_THREADS: int = int(os.getenv("WHISPER_CPU_THREADS", "2"))
    WHISPER_NUM_WORKERS: int = int(os.getenv("WHISPER_NUM_WORKERS", "1"))

    # Concurrency & Memory Controls for Cloud Deployments (e.g. Render)
    MAX_CONCURRENT_PIPELINE_JOBS: int = int(os.getenv("MAX_CONCURRENT_PIPELINE_JOBS", "1"))
    TORCH_NUM_THREADS: int = int(os.getenv("TORCH_NUM_THREADS", "1"))
    UNLOAD_WHISPER_AFTER_TRANSCRIPTION: bool = (
        os.getenv("UNLOAD_WHISPER_AFTER_TRANSCRIPTION", "true").lower() in ("true", "1", "yes")
    )
    UNLOAD_EMBEDDINGS_AFTER_PIPELINE: bool = (
        os.getenv("UNLOAD_EMBEDDINGS_AFTER_PIPELINE", "false").lower() in ("true", "1", "yes")
    )
    FFMPEG_EXTRACT_AUDIO: bool = (
        os.getenv("FFMPEG_EXTRACT_AUDIO", "true").lower() in ("true", "1", "yes")
    )


settings = Settings()

# Ensure media directory exists
settings.MEDIA_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

