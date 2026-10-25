# System Architecture & Design

## 1. High-Level Architecture Overview

LectureLens adopts a modular, decoupled architecture consisting of a **React 19 Frontend**, a **FastAPI Asynchronous Backend**, an **AI/ML Processing Engine**, and **MongoDB Atlas** for document storage and Vector Search.

```mermaid
graph TD
    subgraph Client Tier ["Client Tier (Browser)"]
        UI_T["Teacher Studio (React 19)"]
        UI_S["Student Learning Hub (React 19)"]
        VP["Interactive Video Player (YouTube / HTML5 Seek)"]
    end

    subgraph API & Application Tier ["FastAPI Application Tier"]
        GW["FastAPI Core App (app.main)"]
        AUTH_MW["JWT & RBAC Security Middleware"]
        ROUTERS["Modular APIRouters (auth, courses, lectures, search, quizzes)"]
        BG["FastAPI BackgroundTasks Queue"]
    end

    subgraph AI Service Tier ["AI & Machine Learning Services"]
        WHISPER["Faster-Whisper (small, int8 CPU)"]
        TRANSFORMER["SentenceTransformers (paraphrase-multilingual-MiniLM-L12-v2)"]
        SUMM["Extractive Summarizer (Centroid Cosine)"]
        QA_ENG["Grounded RAG Engine (Abstention Gate)"]
    end

    subgraph Data & Persistence Tier ["Data & Persistence Tier"]
        DB["MongoDB Atlas (lecturelens_db)"]
        VS["Atlas Vector Search ($vectorSearch on lecture_chunks)"]
        FS["Local Media Storage (data/uploads)"]
    end

    UI_T -->|REST API + JWT| GW
    UI_S -->|REST API + JWT| GW
    GW --> AUTH_MW
    AUTH_MW --> ROUTERS
    ROUTERS --> DB
    ROUTERS --> BG
    BG --> WHISPER
    BG --> TRANSFORMER
    BG --> SUMM
    ROUTERS --> QA_ENG
    QA_ENG --> VS
    ROUTERS --> FS
    VP -.->|HTTP 206 Range Stream| FS
```

---

## 2. Component Responsibilities & Separation of Concerns

### 1. Frontend Tier (`frontend/src/`)
- **Single Page Application (SPA)**: Built with React 19 and Vite 8 for fast build and reload times.
- **Client-Side Routing**: Managed via `react-router-dom` v7 with role-guarded route trees (`/teacher/*` vs `/student/*`).
- **Central API Client**: [`frontend/src/api/client.js`](file:///Users/ananadmauya/Projects/lecturelens/frontend/src/api/client.js) centralizes all REST interactions, handles Bearer token injection, and intercepts 401 session expiration events.
- **Interactive Player**: Uses a unified imperative ref API (`seekTo(seconds)`) supporting both YouTube iframes (via postMessage) and HTML5 `<video>` / `<audio>` elements.

### 2. Backend Tier (`backend/app/`)
- **FastAPI Framework**: High-performance asynchronous Python framework using ASGI (`uvicorn`).
- **Strict Lifespan Management**: Initializes database connections, runs index verification, and seeds initial accounts on startup; closes resources cleanly on shutdown.
- **Pydantic v2 Validation**: Validates all incoming payloads (`UserRegister`, `LectureCreate`, `SearchRequest`, `QuizAttemptSubmit`) and serializes responses.
- **Decoupled Service Layer**: Business logic and ML inference are isolated into dedicated modules under `app.services.*`, leaving routers lightweight and focused on HTTP status codes and permissions.

### 3. Database Tier (`MongoDB Atlas`)
- **Document Model**: Leverages MongoDB's flexible BSON document model for complex hierarchical structures like lecture transcripts and quiz breakdowns.
- **Atlas Vector Search**: Executes `$vectorSearch` aggregations directly against the database cluster, eliminating the operational overhead of a separate vector database (e.g. Pinecone or Milvus).
- **Asynchronous Driver**: Utilizes `motor.motor_asyncio` to prevent I/O blocking during database calls.

---

## 3. Core Workflows & Sequence Diagrams

### Workflow A: Lecture Ingestion & Processing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant UI as Teacher Studio
    participant API as FastAPI Backend
    participant BG as BackgroundTasks Worker
    participant Whisper as Faster-Whisper ASR
    participant MiniLM as SentenceTransformer
    participant DB as MongoDB Atlas

    Teacher->>UI: Uploads MP4 or submits YouTube URL
    UI->>API: POST /api/lectures/upload or /youtube
    API->>DB: Insert Lecture (status: 'queued', is_published: false)
    API->>BG: Dispatch run_lecture_processing_pipeline(lecture_id)
    API-->>UI: 200 OK (Returns queued lecture record immediately)
    UI->>Teacher: Displays "AI Processing Pipeline Running..."

    Note over BG: Background Execution Starts
    BG->>DB: Update Lecture status -> 'processing'
    alt File Upload
        BG->>Whisper: transcribe_file(media_path)
        Whisper-->>BG: Timestamped segments + uncertainty indicators (avg_logprob)
    else YouTube URL
        BG->>BG: fetch_youtube_transcript(video_id)
    end
    BG->>DB: Save segments to transcript_segments collection

    BG->>MiniLM: segment_topics(segments)
    MiniLM-->>BG: Thematic topics with start/end boundaries
    BG->>DB: Save topics collection

    BG->>MiniLM: Extract centroid summaries
    BG->>DB: Save summaries collection

    BG->>MiniLM: Batch encode search chunks (384-d vectors)
    BG->>DB: Index chunks in lecture_chunks collection

    BG->>BG: Generate candidate MCQ quiz drafts (is_approved=False)
    BG->>DB: Save draft questions to quizzes collection

    BG->>DB: Update Lecture status -> 'review_required'
    Note over UI,Teacher: Polling or refresh updates UI to Review Mode
```

---

### Workflow B: Teacher Review & Publication Gate

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant UI as LectureReview Screen
    participant API as FastAPI Backend
    participant DB as MongoDB Atlas

    Teacher->>UI: Reviews transcript & spots ASR typo
    Teacher->>UI: Edits segment text & clicks Save Correction
    UI->>API: PATCH /api/lectures/{id}/transcript
    API->>DB: Update segment text & mark is_edited=true
    API->>DB: Insert audit_logs entry (previous_text vs new_text)
    API->>DB: Re-index corresponding lecture_chunks in vector storage
    API-->>UI: 200 OK ("Segment corrected and search index updated")

    Teacher->>UI: Reviews generated quiz questions
    UI->>API: PATCH /api/quizzes/{quiz_id}/approve (is_approved: true)
    API->>DB: Set quiz is_approved=true
    API->>DB: Insert audit_logs entry (quiz_approval)
    API-->>UI: 200 OK

    Teacher->>UI: Clicks "Approve & Publish to Students"
    UI->>API: PATCH /api/lectures/{id}/publish (is_published: true)
    API->>DB: Update lecture is_published=true
    API->>DB: Synchronize is_published=true on all lecture_chunks
    API-->>UI: 200 OK (Lecture now visible in Student Portal)
```

---

### Workflow C: Student Semantic Search & Grounded Q&A (RAG)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI as Student Portal
    participant API as FastAPI Backend
    participant Vector as Vector Search Engine
    participant QA as Grounded Q&A Service
    participant DB as MongoDB Atlas

    Student->>UI: Submits academic question: "What is backpropagation?"
    UI->>API: POST /api/qa (or /api/search)
    API->>QA: answer_question(query, student_enrolled_courses)
    QA->>Vector: search_chunks(query, only_published=true)
    Vector->>Vector: Generate 384-d query embedding (SentenceTransformers)

    alt Live Atlas Connected
        Vector->>DB: Execute $vectorSearch aggregation stage on lecture_chunks
    else Local Fallback
        Vector->>DB: Fetch matching course chunks & compute in-memory cosine similarity
    end
    DB-->>Vector: Top-k matching passages with timestamps & similarity scores

    alt Top Score < 0.30 (Insufficient Evidence)
        QA-->>API: Returns abstention: "Insufficient evidence in lecture material"
    else Top Score >= 0.30 (Grounded)
        QA->>QA: Synthesize answer strictly from retrieved passages
        QA->>QA: Build clickable timestamp citations
        QA-->>API: Returns grounded answer + citations list
    end

    API-->>UI: 200 OK (QAResponse)
    UI->>Student: Displays grounded answer with clickable citations
    Student->>UI: Clicks citation timestamp [12:30]
    UI->>UI: Video player immediately jumps to 12:30 and begins playback
```

---

## 4. Key Architectural Trade-Offs

| Decision | Selected Approach | Alternative Considered | Rationale |
| :--- | :--- | :--- | :--- |
| **Database** | MongoDB Atlas with Vector Search | PostgreSQL (pgvector) or SQLite + ChromaDB | MongoDB Atlas combines document metadata, transcript arrays, and vector search in a single managed cluster, avoiding dual-database sync issues. |
| **API Framework** | Python FastAPI | Node.js / Express | Native Python ecosystem is required for direct in-process execution of Faster-Whisper, PyTorch, and Sentence Transformers without multi-process IPC. |
| **ASR Engine** | Faster-Whisper (CTranslate2) | OpenAI Cloud Whisper API | Self-hosted Faster-Whisper on CPU runs locally without API costs, respects student data privacy, and supports offline execution. |
| **Embedding Model** | `paraphrase-multilingual-MiniLM-L12-v2` (384-d) | Monolingual English embeddings (`all-MiniLM-L6-v2`) | Lectures in Indian universities frequently alternate between Hindi and English; multilingual embeddings preserve semantic proximity across languages. |
| **RAG Abstention Gate** | Strict similarity cutoff ($\text{similarity} < 0.30$) | Unbounded generative completion | Prevents generative hallucination on questions outside course scope (e.g. general trivia or cooking recipes). |

