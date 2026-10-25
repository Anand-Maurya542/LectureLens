import logging
from functools import lru_cache
from typing import Optional
from faster_whisper import WhisperModel
from app.config import settings

logger = logging.getLogger("lecturelens.transcription")


@lru_cache(maxsize=1)
def get_model():
    """Initializes and caches the Faster-Whisper model according to configuration."""
    logger.info(
        f"Loading Faster-Whisper model (size: {settings.WHISPER_MODEL_SIZE}, "
        f"device: {settings.WHISPER_DEVICE}, compute: {settings.WHISPER_COMPUTE_TYPE})"
    )
    return WhisperModel(
        settings.WHISPER_MODEL_SIZE,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )


def transcribe_file(
    file_path: str,
    language: Optional[str] = None,
    beam_size: int = 5,
    vad_filter: bool = True,
) -> dict:
    """Transcribes an audio or video file using Faster-Whisper.
    Extracts timestamps, text, detected language, and model uncertainty indicators.
    """
    model = get_model()

    segments, info = model.transcribe(
        file_path,
        beam_size=beam_size,
        language=language if language and language != "auto" else None,
        vad_filter=vad_filter,
    )

    transcript = []

    # Consume the generator and collect all segments with uncertainty indicators
    for idx, segment in enumerate(segments):
        # Calculate a normalized uncertainty score based on avg_logprob
        # Logprob is typically between 0 (very confident) and -1 or lower (less confident).
        logprob = getattr(segment, "avg_logprob", None)
        no_speech = getattr(segment, "no_speech_prob", None)
        compression = getattr(segment, "compression_ratio", None)

        transcript.append({
            "segment_index": idx,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
            "avg_logprob": round(logprob, 3) if logprob is not None else None,
            "no_speech_prob": round(no_speech, 3) if no_speech is not None else None,
            "compression_ratio": round(compression, 3) if compression is not None else None,
            "is_edited": False,
        })

    logger.info(f"Transcription completed: language={info.language} ({info.language_probability:.2f}), segments={len(transcript)}")

    return {
        "language": info.language,
        "language_probability": round(info.language_probability, 3) if info.language_probability else 1.0,
        "duration": round(info.duration, 2) if hasattr(info, "duration") and info.duration else 0.0,
        "segments": transcript,
    }
