import logging
import re
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger("lecturelens.youtube")

YOUTUBE_REGEX = re.compile(
    r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
)


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extracts the 11-character YouTube video ID from various URL formats."""
    if not url:
        return None
    match = YOUTUBE_REGEX.search(url.strip())
    if match:
        return match.group(1)
    return None


def get_youtube_embed_url(video_id: str) -> str:
    """Returns the privacy-enhanced embed URL for the official embedded video player."""
    return f"https://www.youtube-nocookie.com/embed/{video_id}?enablejsapi=1&rel=0"


def fetch_youtube_transcript(
    video_id: str,
    languages: list[str] = ["en", "hi"],
) -> dict:
    """Fetches official or auto-generated captions via YouTube transcript API.
    Supports both youtube-transcript-api v1.2+ (instance .fetch/.list) and legacy v0.x.
    Returns normalized transcript segments or raises an informative exception.
    """
    try:
        raw_snippets = None
        detected_language = languages[0] if languages else "en"
        preferred = list(languages) + ["en-US", "en-GB", "hi-Latn"]

        # Setup HTTP session with browser user-agent to avoid automated request blocks
        session = None
        try:
            import requests
            session = requests.Session()
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
            })
        except Exception:
            session = None

        # Check API version: v1.2+ uses instance methods .fetch() or .list()
        try:
            api_instance = YouTubeTranscriptApi(http_client=session) if session else YouTubeTranscriptApi()
            if hasattr(api_instance, "list"):
                try:
                    transcript_list = api_instance.list(video_id)
                    # 1. Try finding preferred language transcript
                    try:
                        t = transcript_list.find_transcript(preferred)
                        raw_snippets = t.fetch()
                        detected_language = getattr(t, "language_code", detected_language)
                    except Exception:
                        # 2. Try translating any translatable transcript to English
                        for candidate in transcript_list:
                            try:
                                if getattr(candidate, "is_translatable", False):
                                    raw_snippets = candidate.translate("en").fetch()
                                    detected_language = "en"
                                    break
                                else:
                                    raw_snippets = candidate.fetch()
                                    detected_language = getattr(candidate, "language_code", detected_language)
                                    break
                            except Exception:
                                continue
                except Exception as list_err:
                    logger.info(f"Listing transcripts returned: {list_err}")

            if raw_snippets is None and hasattr(api_instance, "fetch"):
                try:
                    raw_snippets = api_instance.fetch(video_id, languages=preferred)
                except Exception:
                    pass
        except Exception:
            pass

        # Legacy v0.x fallback if get_transcript is a classmethod
        if raw_snippets is None and hasattr(YouTubeTranscriptApi, "get_transcript"):
            try:
                raw_snippets = YouTubeTranscriptApi.get_transcript(video_id, languages=preferred)
            except Exception:
                pass

        if raw_snippets is None:
            raise RuntimeError("No transcript could be retrieved for this video.")

        segments = []
        for idx, item in enumerate(raw_snippets):
            start = round(getattr(item, "start", item.get("start", 0.0) if isinstance(item, dict) else 0.0), 2)
            dur = round(getattr(item, "duration", item.get("duration", 0.0) if isinstance(item, dict) else 0.0), 2)
            end = round(start + dur, 2)
            text = (getattr(item, "text", item.get("text", "") if isinstance(item, dict) else "")).strip()
            if text:
                segments.append({
                    "segment_index": idx,
                    "start": start,
                    "end": end,
                    "text": text,
                    "avg_logprob": 0.0,
                    "no_speech_prob": 0.0,
                    "compression_ratio": 1.0,
                    "is_edited": False,
                })

        duration = segments[-1]["end"] if segments else 0.0
        return {
            "success": True,
            "segments": segments,
            "duration": duration,
            "language": detected_language,
            "message": f"Successfully retrieved {len(segments)} caption segments from YouTube.",
        }

    except Exception as e:
        logger.warning(f"Could not retrieve automated YouTube captions for {video_id}: {e}")
        return {
            "success": False,
            "segments": [],
            "duration": 0.0,
            "language": "unknown",
            "message": (
                f"Captions unavailable for this YouTube video ({str(e)}). "
                "You can supply custom subtitles (.srt/.vtt) or upload the recording directly."
            ),
        }
