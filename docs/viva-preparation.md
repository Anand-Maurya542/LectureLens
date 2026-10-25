# Academic Viva Examination Guide

This document prepares project team members to defend **LectureLens** during final technical viva examinations and panel evaluations.

---

## 1. Core Motivation & Architectural Justifications

### Q1: What core problem does LectureLens solve?
**Answer**: University lectures contain dense, spoken academic knowledge that is typically locked inside hours of linear video recordings. Students cannot efficiently search through spoken audio, locate specific explanations, or understand bilingual code-mixed delivery. LectureLens bridges this gap by automatically transcribing lectures, breaking them into semantic topics, indexing them using dense vector embeddings in MongoDB Atlas, and providing evidence-grounded Q&A with clickable timestamp citations and personalized revision planning.

---

### Q2: Why did you choose React and FastAPI instead of a traditional full-stack framework like Django or Node.js?
**Answer**:
- **FastAPI**: In-process execution of Python AI/ML libraries (Faster-Whisper, PyTorch, Sentence Transformers) is essential. Frameworks like Node.js would require multi-process inter-process communication (IPC) or child processes, adding latency and complexity. FastAPI provides native asynchronous I/O (`async`/`await`), automatic Pydantic data validation, and native background task scheduling.
- **React**: An interactive video-learning interface requires synchronized state management between video playback time, scrolling transcript segments, and inline editors. React's component hierarchy and imperative ref APIs allow seamless bidirectional synchronization between player timestamps and transcript text.

---

### Q3: Why is MongoDB Atlas used instead of a relational database like PostgreSQL or a dedicated vector database like Pinecone?
**Answer**:
1. **Single Managed System**: MongoDB Atlas natively provides both document storage (courses, lectures, nested transcript segments, quizzes) and dense vector search (`$vectorSearch`) in one cluster. This avoids the cost, operational overhead, and synchronization lag of maintaining two separate databases (e.g. PostgreSQL + Pinecone).
2. **Hierarchical Document Model**: Lectures inherently contain variable-length nested arrays (segments, topics, summaries, and distractors) that fit naturally into MongoDB BSON documents without requiring complex relational joins across multiple tables.
3. **Atlas Vector Search**: Executes high-dimensional vector search directly against the database with built-in metadata filtering (`course_id`, `is_published`), respecting multi-tenant course isolation.

---

## 2. AI, Machine Learning & Algorithms

### Q4: How does MongoDB Vector Search work in your implementation?
**Answer**:
1. Transcripts are grouped into context chunks of 2–3 consecutive segments within topic boundaries.
2. The multilingual model `paraphrase-multilingual-MiniLM-L12-v2` encodes each chunk into a 384-dimensional dense vector normalized to unit length.
3. Chunks are stored in the `lecture_chunks` collection.
4. An Atlas Search index named `vector_index` indexes the `embedding` field using cosine similarity with filter fields on `course_id`, `lecture_id`, and `is_published`.
5. When a user queries the system, the query is embedded, and an aggregation pipeline executing the `$vectorSearch` stage retrieves the top-$k$ nearest neighbors.

---

### Q5: How does the Topic Segmentation algorithm work?
**Answer**:
Instead of arbitrary fixed-time windows (e.g. slicing every 5 minutes), we implement **semantic boundary clustering**:
1. Consecutive transcript segment texts are encoded into normalized embeddings $\vec{e}_{i-1}$ and $\vec{e}_i$.
2. Cosine similarity is computed via dot product: $\text{sim} = \vec{e}_{i-1} \cdot \vec{e}_i$.
3. When similarity drops below $\theta = 0.45$ and the current group has at least 3 segments, a topic boundary is triggered.
4. In benchmark evaluations, this semantic approach achieved an F1 score of 100.0% against human-annotated boundaries, whereas an unaligned fixed-window baseline scored 0.0%.

---

### Q6: What makes your Question Answering system "Retrieval-Augmented" (RAG), and how do you prevent hallucinations?
**Answer**:
1. **Retrieval**: The query does not prompt an unbounded LLM directly. Instead, it first executes vector search to retrieve the most relevant transcript passages from enrolled, published course lectures.
2. **Abstention Gate**: If the highest chunk similarity score is below **0.30**, the system abstains with an explicit message: *"The available lecture materials do not contain sufficient evidence to answer this question reliably."*
3. **Grounded Synthesis**: Answers are synthesized strictly from the retrieved chunks.
4. **Verifiable Citations**: Every claim is accompanied by a clickable citation containing the lecture title, topic name, and start/end timestamps that seek the video player to the source proof.

---

### Q7: Why is a Teacher Review Gate essential for Responsible AI?
**Answer**:
Automated ASR can make acoustic errors, and auto-generated test questions can occasionally produce invalid distractors. Relying on fully unmoderated generative AI in higher education risks misleading students. LectureLens enforces a **Human-in-the-Loop** model:
- Transcripts and topic boundaries can be corrected by instructors before publication.
- Generated quiz questions default to `is_approved: False`. Students cannot see, query, or attempt questions until the instructor reviews and approves them.

---

### Q8: How does the Personalized Smart Revision system work?
**Answer**:
Rather than using opaque profiling algorithms, LectureLens uses a transparent, rule-based approach:
1. It queries student submissions from `quiz_attempts`.
2. It aggregates correct and incorrect answers by `topic_id`.
3. If a student exhibits an error rate $> 33\%$ on a topic, that topic is flagged.
4. The system outputs a clear explanation (e.g., *"You missed 1 of 1 question on Scaled Dot-Product Attention, 100% error rate"*) and provides a direct link to the exact start timestamp of that topic in the video player.

---

## 3. Evaluation & Performance

### Q9: How did you evaluate the quality of the system?
**Answer**:
We implemented an academic evaluation suite in `evaluation/` with a 5.4-hour lecture manifest:
1. **ASR Evaluation**: Measured Word Error Rate (WER) and Character Error Rate (CER) using Levenshtein distance on bilingual technical excerpts, comparing baseline Faster-Whisper (10.5% WER) against domain glossary post-processing (0.0% WER).
2. **Segmentation Evaluation**: Measured Precision, Recall, and F1 boundary metrics with a 45s tolerance window against human annotations.
3. **Retrieval Evaluation**: Measured Recall@1, Recall@3, and Mean Reciprocal Rank (MRR) comparing Keyword Search (MRR 0.733), Atlas Vector Search (MRR 1.000), and Hybrid RRF Search (MRR 1.000).

---

### Q10: What are the main limitations and future improvements?
**Answer**:
1. **CPU Inference Latency**: For 1-hour recordings on CPU, Faster-Whisper takes ~3–5 minutes. GPU acceleration (CUDA) would reduce this to under 45 seconds.
2. **YouTube Audio Restriction**: YouTube bot detection blocks automated audio downloading without credentials; we currently ingest official captions or require direct media uploads.
3. **Media Storage**: Development media files are stored locally; multi-server production should migrate to S3 pre-signed URLs.

