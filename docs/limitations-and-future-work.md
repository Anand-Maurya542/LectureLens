# Limitations & Future Roadmap

This document outlines current architectural limitations, known failure cases, and prioritized future enhancements.

---

## 1. Verified Current Limitations

### 1. CPU-Only AI Inference Latency
- **Current State**: Faster-Whisper and Sentence Transformers run on CPU with `int8` quantization.
- **Impact**: Transcribing a 60-minute lecture on a standard CPU takes approximately 3 to 6 minutes. While non-blocking background tasks prevent HTTP timeouts, real-time interactive transcription requires dedicated GPU hardware (NVIDIA CUDA or Apple Silicon MPS).

### 2. YouTube Audio Download Restrictions
- **Current State**: Due to YouTube terms of service, IP rate limiting, and bot-detection mechanisms, automated background audio ripping from arbitrary YouTube links is restricted.
- **Current Mitigation**: LectureLens ingests available public captions via `youtube-transcript-api` and supports embedded iframe playback. If captions are disabled, instructors must upload the video/audio file directly.

### 3. Local Media Storage
- **Current State**: Media uploads are stored on the local filesystem in `data/uploads/` and served via HTTP 206 partial content streaming.
- **Limitation**: Local storage is not horizontally scalable across multiple backend instances. In multi-server cloud deployments, files must be stored on persistent cloud object storage (e.g. AWS S3, Google Cloud Storage, or MinIO).

### 4. Client-Side JWT Storage
- **Current State**: JWT tokens are persisted in browser `localStorage`.
- **Limitation**: While standard for SPAs, tokens in `localStorage` can be vulnerable to cross-site scripting (XSS) attacks. Future enterprise revisions should store session tokens in `httpOnly` secure cookies.

---

## 2. Known Failure Cases & Edge Behaviors

| Scenario | System Behavior | Mitigation Strategy |
| :--- | :--- | :--- |
| **Heavy Code-Mixed Speech (Hindi-English)** | Faster-Whisper occasionally transcribes English technical jargon into Devanagari phonetics. | Surfaced via `UncertaintyPill` (Review Suggested). Instructors can correct words via the inline transcript editor. |
| **YouTube Video Without Captions** | Ingestion pipeline fails with error *"Captions unavailable for this YouTube video"*. | The system provides an explicit error message prompting the instructor to upload the recording file directly. |
| **Unrelated Student Q&A Query** | Student asks a question unrelated to the lecture (e.g., cooking recipes or general pop culture). | Handled by the **Responsible AI Abstention Gate**: similarity score falls below 0.30, and the system explicitly abstains rather than hallucinating. |
| **Atlas Vector Search Index Still Building** | If the vector index is newly created and not yet active, aggregation queries may return an index error. | The vector search service catches the exception and falls back to local in-memory cosine calculation. |

---

## 3. Prioritized Future Roadmap

### Milestone 1: Cloud Object Storage & CDN Integration
- Replace local `data/uploads` storage with AWS S3 or Google Cloud Storage.
- Generate pre-signed streaming URLs with expiring tokens for secure, authenticated media playback.

### Milestone 2: GPU Acceleration & Real-Time Streaming ASR
- Provision GPU container instances with NVIDIA TensorRT-LLM or vLLM.
- Implement WebSocket-based live streaming transcription during active live lectures.

### Milestone 3: Abstractive Summarization with Small Language Models
- Add support for lightweight local instruction-tuned LLMs (e.g. Llama 3 8B, Mistral 7B, or Gemma 2) for abstractive lecture notes and conceptual synthesis, operating behind the teacher review gate.

### Milestone 4: Flashcards & Spaced Repetition (Anki Export)
- Generate downloadable spaced repetition flashcards from approved lecture quiz questions for offline exam preparation.

