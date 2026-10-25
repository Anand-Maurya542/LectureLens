# AI & Machine Learning Pipeline

LectureLens integrates speech recognition, multilingual transformer representations, semantic clustering, dense vector search, and retrieval-augmented generation.

```mermaid
flowchart TD
    AUDIO["Audio / Video Input (or YouTube Captions)"] --> ASR["Faster-Whisper ASR (small, int8 CPU)"]
    ASR --> SEGMENTS["Timestamped Segments + Uncertainty (avg_logprob)"]
    SEGMENTS --> ST["SentenceTransformer (paraphrase-multilingual-MiniLM-L12-v2)"]
    ST --> TOPICS["Semantic Topic Boundaries & Titles"]
    TOPICS --> SUMM["Centroid-Based Extractive Summaries"]
    TOPICS --> CHUNKS["Search Context Chunks (2-3 Segments)"]
    CHUNKS --> EMB["384-Dimensional Dense Vector Embeddings"]
    EMB --> VS["MongoDB Atlas Vector Search (lecture_chunks)"]
    TOPICS --> QUIZ_GEN["MCQ Assessment Generation (is_approved=False)"]
```

---

## 1. Speech-to-Text Recognition (ASR)

### Model & Runtime Architecture
- **Engine**: Faster-Whisper (re-implementation of OpenAI Whisper using CTranslate2).
- **Model Size**: `small` (~244M parameters).
- **Device & Quantization**: CPU inference with `int8` quantization. This setup runs efficiently on laptops without requiring high-end dedicated GPUs.
- **Language Selection**: Configurable per lecture (`auto`, `en`, `hi`). Auto-detection identifies language probability.

### Uncertainty & Confidence Metrics
Faster-Whisper provides raw probabilistic metrics on each transcribed segment:
- `avg_logprob`: Logarithmic probability of generated tokens (typically between 0.0 for high confidence to -1.0+ for low confidence).
- `no_speech_prob`: Probability that the segment consists only of silence, music, or background noise.
- `compression_ratio`: Evaluates repetitive degeneration loops.

In [`backend/app/services/transcription.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/services/transcription.py), these values are preserved on every segment and surfaced in the UI:
- `avg_logprob >= -0.2`: **High Confidence** (Green)
- `-0.5 <= avg_logprob < -0.2`: **Moderate Confidence** (Amber)
- `avg_logprob < -0.5`: **Review Suggested** (Red)

### Known Issues in Bilingual Lectures
In code-mixed Hindi-English lectures, technical terms pronounced in English with an Indian accent (e.g. *"backpropagation"*, *"gradient descent"*) can occasionally be transcribed into Devanagari phonetics (e.g. *बैकप्रोपगेशन*). LectureLens addresses this with an inline transcript correction editor and technical glossary post-processing.

---

## 2. Thematic Topic Segmentation

### Methodology
Traditional segmentation approaches rely on arbitrary fixed-time windows (e.g. every 5 minutes), which split sentences and disrupt explanations mid-concept. LectureLens implements semantic boundary detection:

1. Transcripts are converted into clean text strings.
2. The multilingual model `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` encodes each segment into a 384-dimensional normalized vector:
   $$\vec{e}_i = \frac{f(\text{seg}_i)}{\|f(\text{seg}_i)\|}$$
3. Cosine similarity between consecutive segment embeddings is computed via dot product:
   $$\text{sim}(\vec{e}_{i-1}, \vec{e}_i) = \vec{e}_{i-1} \cdot \vec{e}_i$$
4. A topic boundary is established when similarity drops below the threshold ($\theta = 0.45$) and the current topic has accumulated at least 3 segments:
   $$\text{split} = (\text{sim} < 0.45) \land (\text{len}(\text{current\_group}) \ge 3)$$
5. Topic titles are derived from the key opening phrase of the section.

### Baseline Comparison
[`backend/app/services/segmentation.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/services/segmentation.py) provides `baseline_fixed_window_segmentation(segments, window_duration_seconds=300.0)`. In our evaluation benchmarks, the semantic transformer achieved a **100.0% boundary F1 score** within a 45-second tolerance window, compared to **0.0%** for the unaligned fixed-window baseline.

---

## 3. Extractive Summarization

Implemented in [`backend/app/services/summarization.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/services/summarization.py):
1. **Centroid Vector Calculation**: Computes the mean vector of all segment embeddings within a topic section:
   $$\vec{c} = \frac{\sum_{i=1}^N \vec{e}_i}{\|\sum_{i=1}^N \vec{e}_i\|}$$
2. **Centrality Scoring**: Computes the cosine similarity of each sentence to the topic centroid:
   $$s_i = \vec{e}_i \cdot \vec{c}$$
3. **Selection**: Selects the top 3 most representative sentences, sorts them chronologically to preserve discourse flow, and saves supporting segment indices.

---

## 4. Dense Vector Retrieval & Atlas Search

### Chunking Specification
- **Window Size**: 2 to 3 consecutive segments (~80–180 words) constrained within topic boundaries.
- **Overlap**: 1 segment sliding window.
- **Vector Dimension**: 384 floats.
- **Distance Metric**: Cosine similarity.

### Search Modes:
1. **Semantic Vector Search**: Generates a query vector and executes `$vectorSearch` in MongoDB Atlas (or local cosine fallback).
2. **Keyword Lexical Search**: Multi-term regex match scored by keyword density across chunks.
3. **Hybrid Search**: Merges vector rankings and keyword rankings using **Reciprocal Rank Fusion (RRF)**:
   $$\text{RRF\_Score}(d) = \sum_{m \in \{\text{vector}, \text{keyword}\}} \frac{1}{60 + \text{rank}_m(d)}$$

---

## 5. Evidence-Grounded Q&A (RAG) & Abstention Gate

Implemented in [`backend/app/services/question_answering.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/services/question_answering.py):

### The Hallucination Mitigation Problem
Standard LLMs hallucinate plausible-sounding answers when asked questions outside their knowledge base. LectureLens prevents this through a dual-stage gate:

1. **Retrieval**: Searches the top 3 most relevant lecture chunks for the query.
2. **Abstention Gate**: If the highest chunk cosine similarity is below **0.30**, the system abstains:
   > *"The available lecture materials do not contain sufficient evidence to answer this question reliably."*
3. **Grounded Synthesis**: If relevance $\ge 0.30$, the answer is constructed strictly from the retrieved lecture passages, with each claim linked to clickable timestamp citations `[start – end]`.

---

## 6. Assessment Generation & Revision Logic

1. **Quiz Draft Generation**: Automatically extracts factual assertions and definitions from segmented topics, creating multiple-choice questions with 1 correct option and 3 distractors.
2. **Mandatory Approval Gate**: All questions are tagged with `is_approved: False`. Students cannot view or fetch unapproved questions.
3. **Scoring & Diagnostic Logging**: Graded on submission; incorrect topics are added to `weak_topics`.
4. **Transparent Revision Rules**: The recommendation engine prioritizes topics with an error rate $> 33\%$, explaining the rationale and linking directly to the lecture video timestamp:
   > *"You missed 1 out of 1 quiz question on this concept (100% error rate). Review at 12m 30s."*

