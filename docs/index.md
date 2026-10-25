# LectureLens Documentation Portal

Welcome to the comprehensive technical and operational documentation for **LectureLens — An Intelligent Lecture Transcription, Search and Personalised Learning Platform**.

This documentation describes the **actual implementation** present in the repository, with architectural explanations, API specifications, database designs, AI pipeline details, local setup instructions, user manuals, and academic viva preparation notes.

---

## 📚 Documentation Map

### 1. General & Architecture
- [**Project Overview & Requirements**](project-overview.md): Problem statement, motivation, functional requirements, scope, and constraints.
- [**Feature Implementation & Verification Matrix**](features-and-status.md): Item-by-item verification status of every backend and frontend feature with code and test references.
- [**System Architecture**](system-architecture.md): End-to-end data flow, Mermaid architecture diagrams, component boundaries, and design trade-offs.

### 2. Implementation Guides
- [**Frontend Guide**](frontend-guide.md): React 19, Vite, React Router, component hierarchy, auth state, API client, and video player seek mechanics.
- [**Backend Guide**](backend-guide.md): FastAPI architecture, lifespan management, routers, request validation, background processing, and error handling.
- [**Database Design & MongoDB Atlas**](database-design.md): All 10 MongoDB collection schemas, relationships, indexing strategies, and Atlas Vector Search index definitions.
- [**API Reference**](api-reference.md): Complete route-by-route API documentation with request/response schemas, status codes, and authorization rules.
- [**AI & Machine Learning Pipeline**](ai-pipeline.md): Faster-Whisper ASR, Sentence Transformers embeddings, topic segmentation, extractive summarization, vector retrieval, and grounded Q&A.
- [**Authentication & Security**](authentication-and-security.md): JWT tokens, bcrypt password hashing, role-based access control (RBAC), recording consent, and security practices.

### 3. Setup, Testing & Deployment
- [**Local Setup Guide**](local-setup.md): Step-by-step setup instructions for macOS (zsh), Linux, and Windows, including Python venv and Node.js.
- [**Testing & Academic Evaluation**](testing-and-evaluation.md): Pytest integration test suite, benchmark evaluation scripts (WER/CER, segmentation F1, retrieval MRR), and dataset manifest.
- [**Deployment Guide**](deployment-guide.md): Docker Compose, production Nginx configuration, cloud environment variables, and persistent media storage.
- [**Troubleshooting Guide**](troubleshooting.md): Diagnosis and resolution for common startup, database, Python environment, and GPU/sandbox errors.

### 4. User Guides & Academic Viva
- [**Teacher / Instructor User Guide**](user-guide-teacher.md): Step-by-step manual for course creation, lecture ingestion, transcript correction, quiz approval, and student analytics.
- [**Student User Guide**](user-guide-student.md): Step-by-step manual for course enrollment, video playback, clickable transcripts, Atlas vector search, grounded Q&A, quizzes, and smart revision.
- [**Academic Viva Examination Guide**](viva-preparation.md): Key conceptual questions, architectural justifications, algorithms, and viva defense answers.
- [**Limitations & Future Work**](limitations-and-future-work.md): Honest technical limitations, failure modes, and planned future milestones.
- [**MongoDB Atlas Vector Search Guide**](mongo_atlas_setup.md): Dedicated walkthrough for setting up free Atlas clusters and creating the `vector_index` search index.

