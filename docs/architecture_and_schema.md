# LectureLens Architecture and Database Schema

## 1. System Architecture

```text
               +----------------------------------------------------+
               |              React 19 + Vite Frontend              |
               | (Teacher Studio / Student Portal / Video Player)   |
               +-------------------------+--------------------------+
                                         | HTTP / REST (JSON)
                                         v
               +----------------------------------------------------+
               |               FastAPI Python Backend               |
               | (JWT Auth, RBAC, Async Lifespan, Background Tasks) |
               +--------+-------------------+------------------+----+
                        |                   |                  |
                        v                   v                  v
                 Faster-Whisper    Sentence Transformers    MongoDB
                    (ASR CPU)         (384-d Multilingual)   Atlas /
                                                           Vector Search
```

---

## 2. MongoDB Collections Schema Reference

### 1. `users`
- `_id`: ObjectId
- `name`: string
- `email`: string (Unique Index)
- `password_hash`: string (bcrypt)
- `role`: string (`"teacher"` | `"student"` | `"admin"`)
- `status`: string (`"active"` | `"inactive"`)
- `created_at`: ISO timestamp

### 2. `courses`
- `_id`: ObjectId
- `title`: string
- `description`: string
- `code`: string (Unique Index, e.g. `"CS401"`)
- `teacher_id`: string (Index)
- `student_ids`: array of string (Index)
- `created_at`: ISO timestamp

### 3. `lectures`
- `_id`: ObjectId
- `title`: string
- `description`: string
- `course_id`: string (Index)
- `teacher_id`: string (Index)
- `source_type`: string (`"upload"` | `"youtube"`)
- `youtube_url`: optional string
- `youtube_video_id`: optional string
- `media_url`: optional string
- `storage_path`: optional string
- `status`: string (`"queued"` | `"processing"` | `"review_required"` | `"published"` | `"failed"`)
- `failure_reason`: optional string
- `language`: string
- `language_probability`: float
- `duration`: float (seconds)
- `is_published`: boolean (Index)
- `segments`: array of transcript objects
- `topics`: array of topic objects
- `summaries`: array of summary objects
- `created_at`: ISO timestamp

### 4. `transcript_segments`
- `_id`: ObjectId
- `lecture_id`: string (Index)
- `segment_index`: int
- `start`: float (seconds)
- `end`: float (seconds)
- `text`: string
- `avg_logprob`: float (model uncertainty indicator)
- `is_edited`: boolean
- `original_text`: optional string

### 5. `topics`
- `_id`: ObjectId
- `lecture_id`: string (Index)
- `topic_id`: int
- `title`: string
- `start`: float
- `end`: float
- `is_edited`: boolean

### 6. `summaries`
- `_id`: ObjectId
- `lecture_id`: string (Index)
- `topic_id`: int
- `summary_type`: string (`"extractive"`)
- `summary_text`: string
- `key_points`: array of string
- `is_approved`: boolean

### 7. `lecture_chunks` (Atlas Vector Search Collection)
- `_id`: ObjectId
- `lecture_id`: string (Index)
- `course_id`: string (Index)
- `topic_id`: int
- `topic_title`: string
- `chunk_index`: int
- `start`: float
- `end`: float
- `text`: string
- `embedding`: array of 384 floats (Vector Index)
- `embedding_model`: string (`"paraphrase-multilingual-MiniLM-L12-v2"`)
- `embedding_dim`: int (384)
- `is_published`: boolean (Index)

### 8. `quizzes`
- `_id`: ObjectId
- `lecture_id`: string (Index)
- `topic_id`: int
- `question_type`: string (`"mcq"`)
- `question`: string
- `options`: array of string
- `correct_answer`: string
- `explanation`: string
- `difficulty`: string (`"easy"` | `"medium"` | `"hard"`)
- `is_approved`: boolean (Index) - Student visible ONLY when `true`

### 9. `quiz_attempts`
- `_id`: ObjectId
- `student_id`: string (Index)
- `student_name`: string
- `lecture_id`: string (Index)
- `score`: float
- `percentage`: float
- `total_questions`: int
- `correct_count`: int
- `results`: array of evaluated responses
- `weak_topics`: array of topic indices
- `created_at`: ISO timestamp

### 10. `audit_logs`
- `_id`: ObjectId
- `user_id`: string (Index)
- `action`: string (`"transcript_edit"`, `"topic_edit"`, `"content_publish"`, `"quiz_approval"`)
- `entity_type`: string
- `entity_id`: string
- `diff`: object
- `timestamp`: ISO timestamp

