# Project Overview & Requirements

## 1. Problem Statement

University lectures contain vast amounts of domain-specific academic knowledge delivered across dozens of audio and video recordings per semester. However, traditional lecture recordings suffer from significant pedagogical and technical bottlenecks:

1. **Unsearchable Knowledge**: Students cannot search through spoken content. Finding a specific concept, theorem, or explanation requires scrubbing through hours of video manually.
2. **Passive, Linear Consumption**: Lectures are linear by nature, while revision is non-linear and concept-focused. Without thematic topic boundaries, students struggle to locate specific lecture sections.
3. **Language Barriers**: In multilingual educational settings (such as Indian higher education institutions), instructors frequently switch between English, Hindi, and technical vernacular. Monolingual ASR tools either misrecognize technical jargon or fail entirely on code-mixed speech.
4. **Hallucination Risks in Generic AI Tools**: When students query generic large language models (LLMs) about lecture materials, models frequently hallucinate facts or cite irrelevant external internet sources instead of course materials.
5. **Lack of Explainable Revision Feedback**: When students score poorly on assessments, they receive a numerical percentage rather than actionable, transparent guidance pointing them back to the exact video explanation they need to re-watch.

---

## 2. Project Motivation & Objectives

**LectureLens** addresses these challenges by transforming university lectures into an intelligent, searchable, and personalized learning workspace.

### Core Objectives:
1. **Accurate Speech-to-Text Ingestion**: Accurately transcribe spoken lecture audio into timestamped text segments using Faster-Whisper, supporting both English and Hindi.
2. **Thematic Topic Segmentation**: Group continuous lecture transcripts into coherent semantic sections using multilingual sentence transformers (`paraphrase-multilingual-MiniLM-L12-v2`).
3. **Semantic Neural Retrieval**: Store 384-dimensional chunk embeddings in MongoDB Atlas and execute `$vectorSearch` queries to find relevant passages based on conceptual meaning, not just exact keywords.
4. **Evidence-Grounded Question Answering (RAG)**: Synthesize answers strictly based on retrieved lecture transcripts, provide clickable timestamp citations, and honestly abstain when evidence is insufficient.
5. **Responsible Human-in-the-Loop AI**: Enforce a mandatory teacher review and approval gate for transcripts, topic boundaries, summaries, and generated quiz questions before any content becomes visible to students.
6. **Explainable Personalized Revision**: Analyze student quiz responses, detect topic-level misunderstandings, and produce transparent recommendations that link directly to the exact video timestamp.

---

## 3. Target Users & Personas

### Persona A: Course Instructor (Teacher)
- **Profile**: University professor or teaching assistant delivering academic courses.
- **Goals**: Ingest lecture recordings, verify auto-generated transcripts for technical accuracy, adjust topic boundaries, approve generated assessment questions, and monitor course-wide student learning analytics.
- **Key Pain Point**: Lack of time to manually create transcripts, topic summaries, and quiz questions from scratch.

### Persona B: Enrolled Student
- **Profile**: Undergraduate or graduate student enrolled in an academic course.
- **Goals**: Search across course lectures, jump directly to relevant video timestamps, ask questions grounded strictly in course material, test understanding via quizzes, and follow personalized revision plans.
- **Key Pain Point**: Spending excessive time searching through lengthy recordings during exam preparation.

---

## 4. Main User Journeys

```mermaid
flowchart TD
    subgraph Teacher Journey
        T1["Teacher Login"] --> T2["Create Course & Get Code"]
        T2 --> T3["Upload Media or Submit YouTube URL"]
        T3 --> T4["AI Pipeline (Whisper ASR + Segmentation + Summaries + Chunks)"]
        T4 --> T5["Review Transcript, Correct Segments, Adjust Topics"]
        T5 --> T6["Approve Quiz Questions & Publish Lecture"]
        T6 --> T7["Inspect Class Performance Analytics"]
    end

    subgraph Student Journey
        S1["Student Login"] --> S2["Enroll in Course via Code"]
        S2 --> S3["Access Published Lectures & Watch with Synced Transcript"]
        S3 --> S4["Semantic Vector Search across Course Content"]
        S4 --> S5["Ask AI Questions with Timestamped Citations"]
        S5 --> S6["Take Approved Section Quizzes"]
        S6 --> S7["Follow Smart Revision Plan (Jump to Video Timestamps)"]
    end
```

---

## 5. Functional Requirements (FR)

| ID | Requirement | Implementation Status |
| :--- | :--- | :--- |
| **FR-1** | **Lecture Media Ingestion**: The system must accept audio/video uploads (`.mp4`, `.mp3`, `.wav`, `.m4a`, etc.) and public YouTube video links. | **Implemented & Verified** |
| **FR-2** | **Speech-to-Text Transcription**: The system must generate timestamped transcript segments with language detection and uncertainty indicators. | **Implemented & Verified** |
| **FR-3** | **Topic Segmentation & Summarization**: The system must divide continuous transcripts into coherent topics and extract salient key points. | **Implemented & Verified** |
| **FR-4** | **Instructor Review & Audit**: Instructors must be able to correct transcripts, edit topic boundaries, and publish/unpublish content, with changes recorded in audit logs. | **Implemented & Verified** |
| **FR-5** | **MongoDB Atlas Vector Search**: The system must index 384-d embeddings into MongoDB Atlas and execute `$vectorSearch` with course and publication filters. | **Implemented & Verified** |
| **FR-6** | **Evidence-Grounded Q&A**: The system must answer questions strictly based on retrieved lecture passages and cite timestamps, abstaining when evidence is insufficient. | **Implemented & Verified** |
| **FR-7** | **Assessment Gate & Quizzes**: The system must auto-generate draft quizzes, require teacher approval, and provide interactive student quiz taking with scoring. | **Implemented & Verified** |
| **FR-8** | **Personalized Smart Revision**: The system must analyze quiz attempts, identify weak topics, and generate transparent recommendations linked to video timestamps. | **Implemented & Verified** |

---

## 6. Non-Functional Requirements (NFR)

| ID | Requirement | Target Specification | Realized Implementation |
| :--- | :--- | :--- | :--- |
| **NFR-1** | **Security & Access Control** | Passwords must be hashed using bcrypt; API routes must enforce role-based access control (RBAC). | Implemented using `bcrypt` salt hashing and signed JWT bearer tokens (`HS256`). Public registration cannot grant teacher privileges. |
| **NFR-2** | **Asynchronous Pipeline Reliability** | Long-running ASR and embedding generation must not block HTTP request threads. | Implemented via FastAPI `BackgroundTasks`, updating states: `queued` $\rightarrow$ `processing` $\rightarrow$ `review_required`. |
| **NFR-3** | **Search Latency** | Semantic search retrieval must return relevant chunks within acceptable interactive limits (< 1 second). | In-memory and Atlas vector search return top-k results in under 200ms. |
| **NFR-4** | **Media Streaming** | Uploaded video and audio playback must support random timestamp seeking. | Implemented range-aware HTTP 206 streaming response in [`backend/app/routers/media.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/routers/media.py). |
| **NFR-5** | **Data Isolation** | Students must not access private lectures or unapproved quizzes from other courses. | Enforced at the database query level on every protected router. |

---

## 7. Current Project Scope & Constraints

### In-Scope:
- Standalone FastAPI backend with PyMongo/Motor asynchronous database driver.
- React 19 + Vite frontend with React Router v7.
- Local and cloud-compatible MongoDB Atlas deployment with Vector Search.
- Offline development fallback mode (`mongomock-motor`) for testing without internet access.
- Academic benchmark evaluation suite for ASR, segmentation, and retrieval.

### Constraints:
- AI inference runs on CPU (using `int8` quantization for Whisper and CPU for Sentence Transformers) to ensure compatibility with standard development laptops without requiring dedicated NVIDIA GPUs.
- Public YouTube ingestion relies on accessible captions or user-supplied transcripts due to YouTube's terms of service and bot-detection restrictions on unauthorized audio downloading.

