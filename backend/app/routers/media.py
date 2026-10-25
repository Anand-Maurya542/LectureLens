import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from app.config import settings

router = APIRouter(prefix="/api/media", tags=["Media Streaming"])


@router.get("/{filename}")
async def stream_media(filename: str, request: Request):
    """Streams uploaded audio/video files with HTTP 206 Partial Content range support
    to enable seamless seeking in HTML5 media players.
    """
    # Sanitize filename to avoid path traversal
    safe_filename = Path(filename).name
    file_path = settings.MEDIA_UPLOAD_DIR / safe_filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Media file not found")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    # Determine content type
    suffix = file_path.suffix.lower()
    content_type_map = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
    }
    content_type = content_type_map.get(suffix, "application/octet-stream")

    if range_header:
        # Range header format: "bytes=start-end"
        try:
            byte_range = range_header.replace("bytes=", "").split("-")
            start = int(byte_range[0]) if byte_range[0] else 0
            end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
            start = max(0, start)
            end = min(file_size - 1, end)
            content_length = (end - start) + 1

            def iterfile():
                with open(file_path, "rb") as f:
                    f.seek(start)
                    bytes_remaining = content_length
                    chunk_size = 1024 * 1024  # 1MB chunks
                    while bytes_remaining > 0:
                        chunk = f.read(min(chunk_size, bytes_remaining))
                        if not chunk:
                            break
                        bytes_remaining -= len(chunk)
                        yield chunk

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": content_type,
            }
            return StreamingResponse(iterfile(), status_code=206, headers=headers)
        except Exception:
            return FileResponse(file_path, media_type=content_type)

    return FileResponse(file_path, media_type=content_type)

