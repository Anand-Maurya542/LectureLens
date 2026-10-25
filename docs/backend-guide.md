# Backend Architecture & Developer Guide

## 1. Application Entry Point & Lifespan

The FastAPI application entry point is [`backend/app/main.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/main.py).

### Lifespan Context Manager
Startup and shutdown sequences are managed via FastAPI's `lifespan` context manager:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting LectureLens API...")
    await connect_to_mongo()     # Connects to Atlas or initializes local mock
    await seed_default_users()   # Ensures demo accounts (teacher, student, admin) exist
    yield
    # Shutdown
    logger.info("Shutting down LectureLens API...")
    await close_mongo_connection()
```

---

## 2. Router Organization & Responsibilities

The backend delegates endpoints to modular `APIRouter` instances:

| Router Module | Path Prefix | Responsibilities | Key Services Called |
| :--- | :--- | :--- | :--- |
| [`auth.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/auth.py) | `/api/auth` | User registration, login, profile retrieval, password hashing | `bcrypt`, `pyjwt`, `database.get_db` |
| [`courses.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/courses.py) | `/api/courses` | Course creation, listing, code-based student enrollment | `database.get_db` |
| [`lectures.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/lectures.py) | `/api/lectures` | Audio/video upload, YouTube ingestion, publication toggle, deletion | `pipeline.run_lecture_processing_pipeline`, `youtube.fetch_youtube_transcript` |
| [`transcript.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/transcript.py) | `/api/lectures/{id}/transcript` | Inline transcript corrections, audit trail recording | `vector_search.index_lecture_chunks` |
| [`topics.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/topics.py) | `/api/lectures/{id}/topics` | Topic title and boundary corrections | `vector_search.index_lecture_chunks` |
| [`search.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/search.py) | `/api/search` | Atlas Vector Search, keyword search, hybrid RRF search, grounded Q&A | `vector_search.search_chunks`, `question_answering.answer_question` |
| [`quizzes.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/quizzes.py) | `/api` | Quiz listing, teacher approval gate, student attempt grading, analytics | `database.get_db` |
| [`revision.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/revision.py) | `/api/revision` | Rule-based weak-topic recommendations | `revision.generate_student_revision_recommendations` |
| [`media.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/media.py) | `/api/media` | HTTP 206 range-aware media streaming for video/audio seek | Standard library file I/O |

---

## 3. Shared Dependencies & Authorization

Defined in [`backend/app/dependencies/auth.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/dependencies/auth.py):

- **`get_current_user`**: Decodes the JWT token from the `Authorization: Bearer <token>` header, fetches the user from MongoDB, and verifies that the account is active.
- **`require_teacher`**: Enforces that `user.role in ["teacher", "admin"]`. Returns HTTP 403 Forbidden if a student attempts teacher-only operations.
- **`require_student`**: Enforces that `user.role in ["student", "teacher", "admin"]` (allowing teachers to preview student views).

---

## 4. Asynchronous Background Processing Pipeline

Long AI operations (Whisper speech-to-text, sentence embeddings, topic segmentation, chunk indexing) are detached from the HTTP request thread using FastAPI's `BackgroundTasks`:

```python
# In lectures.py upload endpoint
background_tasks.add_task(
    run_lecture_processing_pipeline,
    lecture_id=lecture_id,
    media_path=str(dest_path),
    language_hint=language_hint,
)
```

The pipeline handles:
1. State transition to `"processing"`.
2. Speech transcription via Faster-Whisper or YouTube caption extraction.
3. Persistence of raw segments into `transcript_segments`.
4. Thematic topic segmentation into `topics`.
5. Extractive centroid summarization into `summaries`.
6. Dense vector chunk generation and persistence into `lecture_chunks`.
7. Candidate MCQ quiz generation into `quizzes` (default `is_approved = False`).
8. State transition to `"review_required"`.
9. In case of unexpected failures, catches exceptions and writes `status = "failed"` with `failure_reason = str(e)`.

---

## 5. Media Streaming with HTTP 206 Range Support

HTML5 `<video>` and `<audio>` players require HTTP byte-range requests to support random timestamp seeking. In [`backend/app/routers/media.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/media.py), incoming `Range: bytes=start-end` headers are parsed and served via `StreamingResponse(status_code=206)`:

```python
headers = {
    "Content-Range": f"bytes {start}-{end}/{file_size}",
    "Accept-Ranges": "bytes",
    "Content-Length": str(content_length),
    "Content-Type": content_type,
}
return StreamingResponse(iterfile(), status_code=206, headers=headers)
```

---

## 6. How to Add a New Endpoint

1. Define request and response schemas in `app/schemas/<domain>.py`.
2. Add any business or AI logic to `app/services/<service_name>.py`.
3. Create the route in `app/routers/<domain>.py`, applying dependencies (`Depends(require_teacher)` or `Depends(get_current_user)`).
4. Register the router in `app/main.py` using `app.include_router(new_router)`.
5. Add an integration test in `backend/tests/test_api.py`.

