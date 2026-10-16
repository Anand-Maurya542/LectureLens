from functools import lru_cache
from faster_whisper import WhisperModel


@lru_cache(maxsize=1)
def get_model():
    # First run downloads the model.
    # CPU + int8 is a practical starting point for a Mac.
    return WhisperModel(
        "small",
        device="cpu",
        compute_type="int8",
    )


def transcribe_file(file_path: str) -> dict:
    model = get_model()

    segments, info = model.transcribe(
        file_path,
        beam_size=5,
        vad_filter=False,
    )

    transcript = []

    # Consume the generator and collect all segments.
    for segment in segments:
        transcript.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        })

    print(f"Detected language: {info.language}")
    print(f"Language probability: {info.language_probability}")
    print(f"Number of segments: {len(transcript)}")

    return {
        "language": info.language,
        "language_probability": info.language_probability,
        "segments": transcript,
    }