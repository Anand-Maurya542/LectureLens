FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (FFmpeg for media extraction)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app \
    WHISPER_MODEL_SIZE=base \
    WHISPER_CPU_THREADS=2 \
    TORCH_NUM_THREADS=1 \
    MAX_CONCURRENT_PIPELINE_JOBS=1 \
    UNLOAD_WHISPER_AFTER_TRANSCRIPTION=true

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

