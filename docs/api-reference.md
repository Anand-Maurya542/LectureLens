# Complete API Reference

Base URL: `http://127.0.0.1:8000` (or configured deployment host).  
Interactive Swagger UI: `http://127.0.0.1:8000/docs`  
OpenAPI JSON Specification: `http://127.0.0.1:8000/openapi.json`

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Creates a new student account, or a teacher account when provided with an authorized invite code.

- **Auth Required**: None (Public)
- **Request Body**:
  ```json
  {
    "name": "Alex Johnson",
    "email": "alex@university.edu",
    "password": "Password123!",
    "role": "student",
    "teacher_invite_code": null
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": "671aa...01",
      "name": "Alex Johnson",
      "email": "alex@university.edu",
      "role": "student",
      "status": "active",
      "created_at": "2026-10-24T14:30:00Z"
    }
  }
  ```
- **Error Codes**: `400 Bad Request` (Email already registered), `403 Forbidden` (Invalid teacher invite code).

---

### `POST /api/auth/login`
Authenticates user credentials and issues a signed JWT Bearer access token.

- **Auth Required**: None (Public)
- **Request Body**:
  ```json
  {
    "email": "teacher@lecturelens.edu",
    "password": "TeacherPass123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": "671aa...02",
      "name": "Prof. Rajesh Sharma",
      "email": "teacher@lecturelens.edu",
      "role": "teacher",
      "status": "active",
      "created_at": "2026-10-24T14:30:00Z"
    }
  }
  ```
- **Error Codes**: `401 Unauthorized` (Invalid email or password).

---

### `GET /api/auth/me`
Retrieves the profile of the currently authenticated user.

- **Auth Required**: Bearer Token
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**: Returns the authenticated `UserOut` object.

---

## 2. Course Management Endpoints

### `GET /api/courses`
Lists courses relevant to the authenticated user (enrolled courses for students; instructed courses for teachers).

- **Auth Required**: Bearer Token (`student`, `teacher`, `admin`)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": "671aa...03",
      "title": "CS 401: Artificial Intelligence & Machine Learning",
      "description": "Foundations of modern AI",
      "code": "CS401",
      "teacher_id": "671aa...02",
      "teacher_name": "Prof. Rajesh Sharma",
      "student_count": 28,
      "lecture_count": 6,
      "created_at": "2026-10-24T14:30:00Z"
    }
  ]
  ```

---

### `POST /api/courses`
Creates a new course and assigns a unique 6-character uppercase enrollment code.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**:
  ```json
  {
    "title": "CS 502: Advanced Deep Learning",
    "description": "Transformers, attention, and vector search",
    "code": "CS502"
  }
  ```
- **Response (200 OK)**: Returns created `CourseOut` object.
- **Error Codes**: `403 Forbidden` (Students cannot create courses).

---

### `POST /api/courses/enroll`
Enrolls an authenticated student into a course using its enrollment code.

- **Auth Required**: Bearer Token (`student`)
- **Request Body**:
  ```json
  {
    "code": "CS401"
  }
  ```
- **Response (200 OK)**: Returns updated `CourseOut` object.
- **Error Codes**: `404 Not Found` (Invalid course code).

---

## 3. Lecture & Pipeline Endpoints

### `GET /api/lectures`
Lists lectures. Students see only published lectures in enrolled courses; teachers see all lectures in their courses.

- **Auth Required**: Bearer Token
- **Query Params**: `course_id` (optional filter)
- **Response (200 OK)**: Array of `LectureOut` objects.

---

### `POST /api/lectures/upload`
Uploads a local audio or video recording and initiates the background processing pipeline.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Form Data**:
  - `file`: Multipart binary audio/video file (`.mp4`, `.mp3`, `.wav`, etc.)
  - `title`: string
  - `course_id`: string
  - `description`: string (optional)
  - `language_hint`: string (optional, e.g. `"auto"`, `"en"`, `"hi"`)
- **Response (200 OK)**: Returns created `LectureOut` object with `status: "queued"`.

---

### `POST /api/lectures/youtube`
Ingests a public YouTube video lecture by URL and initiates the background pipeline.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**:
  ```json
  {
    "title": "Lecture 4: Self-Attention & Transformers",
    "course_id": "671aa...03",
    "youtube_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY",
    "description": "Attention mechanism deep dive",
    "consent_granted": true
  }
  ```
- **Response (200 OK)**: Returns created `LectureOut` object with `status: "queued"`.

---

### `PATCH /api/lectures/{lecture_id}/publish`
Toggles publication status, making content visible or hidden for enrolled students. Also synchronizes the `is_published` filter flag across all chunks in `lecture_chunks`.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**: `{"is_published": true}`
- **Response (200 OK)**: Updated `LectureOut` object.

---

## 4. Transcript & Topic Review Endpoints

### `PATCH /api/lectures/{lecture_id}/transcript`
Corrects a transcript segment, creates an audit log entry, and re-indexes vector search chunks.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**:
  ```json
  {
    "segment_index": 0,
    "new_text": "Welcome to deep self-attention mechanisms."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Transcript segment corrected successfully",
    "segment": {
      "segment_index": 0,
      "text": "Welcome to deep self-attention mechanisms.",
      "is_edited": true,
      "original_text": "Welcome to deep attention."
    }
  }
  ```

---

### `PATCH /api/lectures/{lecture_id}/topics/{topic_index}`
Updates topic section titles and adjusts start/end boundary timestamps.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**:
  ```json
  {
    "topic_index": 1,
    "new_title": "Self-Attention & Multi-Head Projections",
    "start": 0.0,
    "end": 480.0
  }
  ```
- **Response (200 OK)**: Updated topic object.

---

## 5. Search & Grounded Q&A Endpoints

### `POST /api/search`
Performs semantic vector search, keyword lexical search, or hybrid retrieval across authorized lecture chunks.

- **Auth Required**: Bearer Token
- **Request Body**:
  ```json
  {
    "query": "How are queries and keys calculated?",
    "course_id": "671aa...03",
    "search_mode": "vector",
    "top_k": 5
  }
  ```
- **Response (200 OK)**:
  ```json
  [
    {
      "chunk_id": "671aa...08",
      "lecture_id": "671aa...04",
      "lecture_title": "Lecture 4: Self-Attention & Transformers",
      "topic_title": "Scaled Dot-Product Attention Overview",
      "start": 12.0,
      "end": 28.5,
      "text": "Queries and keys are computed by multiplying the input embeddings by learned projection matrices.",
      "score": 0.884,
      "search_mode": "atlas_vector_search",
      "timestamp_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY&t=12s",
      "source_type": "youtube"
    }
  ]
  ```

---

### `POST /api/qa` (or `POST /api/search/qa`)
Evidence-grounded question answering (RAG) with clickable citations and honest abstention.

- **Auth Required**: Bearer Token
- **Request Body**:
  ```json
  {
    "query": "What replaces recurrence in transformers?",
    "course_id": "671aa...03"
  }
  ```
- **Response (200 OK) — Grounded Answer**:
  ```json
  {
    "query": "What replaces recurrence in transformers?",
    "answer": "Based on Lecture 4: Self-Attention & Transformers (Section: Scaled Dot-Product Attention Overview), self-attention replaces recurrence entirely, allowing all tokens to be processed in parallel.",
    "citations": [
      {
        "lecture_id": "671aa...04",
        "lecture_title": "Lecture 4: Self-Attention & Transformers",
        "topic_title": "Scaled Dot-Product Attention Overview",
        "start": 5.0,
        "end": 10.0,
        "text": "Self-attention replaces recurrence entirely.",
        "timestamp_url": "https://www.youtube.com/watch?v=kCc8FmEb1nY&t=5s"
      }
    ],
    "is_grounded": true,
    "confidence": 0.84
  }
  ```
- **Response (200 OK) — Abstention on Insufficient Context**:
  ```json
  {
    "query": "What is the recipe for chocolate chip cookies?",
    "answer": "The available lecture materials do not contain sufficient evidence to answer this question reliably.",
    "citations": [],
    "is_grounded": false,
    "confidence": 0.0
  }
  ```

---

## 6. Assessment & Revision Endpoints

### `GET /api/lectures/{lecture_id}/quizzes`
Retrieves assessment questions for a lecture. For students, returns **only teacher-approved questions** and strips out correct answers. For instructors, returns all questions including drafts and answers.

- **Auth Required**: Bearer Token

---

### `PATCH /api/quizzes/{quiz_id}/approve`
Teacher approval gate: inspect, edit, and approve a generated quiz question.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Request Body**:
  ```json
  {
    "is_approved": true,
    "question": "What is the primary benefit of multi-head attention?",
    "correct_answer": "Parallel representation subspaces"
  }
  ```
- **Response (200 OK)**: Updated `QuizQuestionOut` object.

---

### `POST /api/lectures/{lecture_id}/quizzes/submit`
Evaluates student responses against approved questions, computes score, detects weak topics, and persists the attempt.

- **Auth Required**: Bearer Token (`student`)
- **Request Body**:
  ```json
  {
    "answers": {
      "671aa...09": "Parallel representation subspaces"
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "id": "671aa...10",
    "student_id": "671aa...01",
    "lecture_id": "671aa...04",
    "score": 100.0,
    "percentage": 100.0,
    "total_questions": 1,
    "correct_count": 1,
    "results": [...],
    "weak_topics": [],
    "created_at": "2026-10-24T15:00:00Z"
  }
  ```

---

### `GET /api/courses/{course_id}/quiz-analytics`
Aggregates class quiz performance and topic-level error rates for instructors.

- **Auth Required**: Bearer Token (`teacher`, `admin`)
- **Response (200 OK)**: Returns `total_attempts`, `average_score`, and `topic_weakness_summary`.

---

### `GET /api/revision/recommendations`
Generates personalized, explainable weak-topic recommendations with video deep links.

- **Auth Required**: Bearer Token (`student`)
- **Response (200 OK)**: Array of `RevisionRecommendation` objects.

