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
    initial_prompt: Optional[str] = None,
    hotwords: Optional[str] = None,
    beam_size: int = 5,
    vad_filter: bool = True,
    repetition_penalty: float = 1.1,
    no_repeat_ngram_size: int = 3,
    hallucination_silence_threshold: Optional[float] = 2.0,
    condition_on_previous_text: bool = False,
) -> dict:
    """Transcribes an audio or video file using Faster-Whisper.
    Extracts timestamps, text, detected language, and model uncertainty indicators.
    Supports technical glossaries via initial_prompt and hotwords, and applies
    repetition penalty and hallucination thresholding to prevent repetitive loops.
    """
    model = get_model()

    transcribe_kwargs = {
        "beam_size": beam_size,
        "language": language if language and language != "auto" else None,
        "vad_filter": vad_filter,
        "condition_on_previous_text": condition_on_previous_text,
    }

    if initial_prompt:
        transcribe_kwargs["initial_prompt"] = initial_prompt
    if hotwords:
        transcribe_kwargs["hotwords"] = hotwords
    if repetition_penalty and repetition_penalty > 1.0:
        transcribe_kwargs["repetition_penalty"] = repetition_penalty
    if no_repeat_ngram_size and no_repeat_ngram_size > 0:
        transcribe_kwargs["no_repeat_ngram_size"] = no_repeat_ngram_size
    if hallucination_silence_threshold:
        transcribe_kwargs["hallucination_silence_threshold"] = hallucination_silence_threshold

    segments, info = model.transcribe(file_path, **transcribe_kwargs)

    transcript = []

    # Consume the generator and collect all segments with uncertainty indicators
    for idx, segment in enumerate(segments):
        # Calculate a normalized uncertainty score based on avg_logprob
        logprob = getattr(segment, "avg_logprob", None)
        no_speech = getattr(segment, "no_speech_prob", None)
        compression = getattr(segment, "compression_ratio", None)
        cleaned_text = segment.text.strip()

        transcript.append({
            "segment_index": idx,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": cleaned_text,
            "original_text": cleaned_text,
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


def group_segments_into_paragraphs(segments: list[dict]) -> list[dict]:
    """Combines short consecutive transcript segments into readable paragraphs.
    Preserves start and end timestamps, underlying segment indices, original AI text,
    and supports English, Hindi, and Hinglish punctuation and sentence boundaries.
    """
    if not segments:
        return []

    paragraphs = []
    current_para_segments = []

    # Sentence-ending punctuation in English, Hindi, and general text
    sentence_end_chars = ('.', '?', '!', '।', '॥')

    def flush_paragraph():
        nonlocal current_para_segments
        if not current_para_segments:
            return

        para_idx = len(paragraphs)
        start_time = current_para_segments[0].get("start", 0.0)
        end_time = current_para_segments[-1].get("end", start_time)

        # Combine texts with spaces
        combined_text = " ".join(s.get("text", "").strip() for s in current_para_segments if s.get("text"))
        combined_original = " ".join(
            (s.get("original_text") or s.get("text", "")).strip()
            for s in current_para_segments if (s.get("original_text") or s.get("text"))
        )
        is_edited = any(s.get("is_edited", False) for s in current_para_segments)
        seg_indices = [s.get("segment_index", i) for i, s in enumerate(current_para_segments)]

        paragraphs.append({
            "paragraph_index": para_idx,
            "start": round(start_time, 2),
            "end": round(end_time, 2),
            "text": combined_text.strip(),
            "original_text": combined_original.strip(),
            "is_edited": is_edited,
            "segment_indices": seg_indices,
        })
        current_para_segments = []

    for idx, seg in enumerate(segments):
        current_para_segments.append(seg)

        seg_text = seg.get("text", "").strip()
        ends_sentence = seg_text.endswith(sentence_end_chars)

        # Calculate current accumulated duration and length
        duration = seg.get("end", 0.0) - current_para_segments[0].get("start", 0.0)
        word_count = sum(len(s.get("text", "").split()) for s in current_para_segments)
        char_count = sum(len(s.get("text", "")) for s in current_para_segments)

        # Check gap between this segment and next segment
        has_speaker_pause = False
        if idx + 1 < len(segments):
            gap = segments[idx + 1].get("start", 0.0) - seg.get("end", 0.0)
            if gap >= 1.8:
                has_speaker_pause = True

        if (
            (ends_sentence and (duration >= 25.0 or char_count >= 300 or has_speaker_pause))
            or duration >= 60.0
            or word_count >= 85
            or (has_speaker_pause and duration >= 15.0)
        ):
            flush_paragraph()

    flush_paragraph()
    return paragraphs


def format_timestamp_srt(seconds: float) -> str:
    millis = int(round((seconds - int(seconds)) * 1000))
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds: float) -> str:
    millis = int(round((seconds - int(seconds)) * 1000))
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d}.{millis:03d}"


def export_transcript_text(segments: list[dict], paragraphs: list[dict] = None, title: str = "") -> str:
    lines = []
    if title:
        lines.append(f"LECTURE TITLE: {title}")
        lines.append("=" * 60)
        lines.append("")

    source_items = paragraphs if paragraphs else segments
    for item in source_items:
        start_min, start_sec = divmod(int(item.get("start", 0)), 60)
        end_min, end_sec = divmod(int(item.get("end", 0)), 60)
        lines.append(f"[{start_min:02d}:{start_sec:02d} - {end_min:02d}:{end_sec:02d}]")
        lines.append(item.get("text", "").strip())
        lines.append("")

    return "\n".join(lines)


def export_transcript_srt(segments: list[dict]) -> str:
    blocks = []
    for idx, seg in enumerate(segments, 1):
        s_time = format_timestamp_srt(seg.get("start", 0.0))
        e_time = format_timestamp_srt(seg.get("end", 0.0))
        text = seg.get("text", "").strip()
        blocks.append(f"{idx}\n{s_time} --> {e_time}\n{text}\n")
    return "\n".join(blocks)


def export_transcript_vtt(segments: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for idx, seg in enumerate(segments, 1):
        s_time = format_timestamp_vtt(seg.get("start", 0.0))
        e_time = format_timestamp_vtt(seg.get("end", 0.0))
        text = seg.get("text", "").strip()
        lines.append(f"{idx}")
        lines.append(f"{s_time} --> {e_time}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)
