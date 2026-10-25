# Troubleshooting & Diagnostic Guide

This guide covers common runtime errors, diagnostic steps, and resolutions for LectureLens.

---

## 1. Backend Server & Python Environment Issues

### Issue 1: `Attribute "app--reload--host..." not found in module "app.main"`
- **Symptom**: `ERROR: Error loading ASGI app. Attribute "app--reload--host127.0.0.1--port8000" not found`
- **Cause**: Missing spaces between flags when executing `uvicorn`.
- **Fix**: Run the command with spaces before each flag:
  ```bash
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```

---

### Issue 2: Apple Metal Compiler Error (`could not build module 'monolithic_metal'`)
- **Symptom**: On macOS Apple Silicon (M1/M2/M3), PyTorch attempts to initialize `mps` (Metal) device inside a sandboxed environment and fails with `Operation not permitted`.
- **Cause**: Apple Metal shader compilation requires filesystem access restricted by strict sandbox profiles.
- **Fix**: In [`backend/app/services/segmentation.py`](file:///Users/ananadmauya/Projects/lecturelens/backend/app/services/segmentation.py), initialize SentenceTransformer explicitly on CPU:
  ```python
  return SentenceTransformer(settings.EMBEDDING_MODEL_NAME, device="cpu")
  ```

---

### Issue 3: `NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently compiled with LibreSSL`
- **Symptom**: Warning printed in terminal when Python starts on macOS.
- **Cause**: macOS default system Python 3.9 was compiled against system LibreSSL rather than OpenSSL.
- **Impact**: Harmless warning for local development; does not block application execution or HTTP calls.

---

## 2. MongoDB Atlas & Vector Search Issues

### Issue 1: `ServerSelectionTimeoutError: [Errno 61] Connection refused`
- **Symptom**: Backend fails to connect or logs a connection timeout to `localhost:27017` or Atlas.
- **Cause**:
  1. For local testing: No local MongoDB server is running.
  2. For Atlas: `MONGODB_URI` has not been configured in `backend/.env`.
- **Fix**: Leave `MONGODB_URI=` blank to use the built-in `mongomock-motor` development fallback, or follow the [MongoDB Atlas Setup Guide](mongo_atlas_setup.md) to paste your real Atlas cluster URI.

---

### Issue 2: `MongoServerError: bad auth : authentication failed`
- **Symptom**: Connection rejected by MongoDB Atlas.
- **Causes**:
  - The database user password is incorrect.
  - The password contains unescaped special characters (e.g. `@`, `#`, `%`).
- **Fix**: URL-encode special characters in the connection string (e.g. `#` becomes `%23`), or reset the database user password in the Atlas web console to an alphanumeric string.

---

### Issue 3: `Operation not permitted` / Atlas Network Timeout
- **Symptom**: Backend hangs for 5 seconds on startup while attempting to connect to Atlas.
- **Cause**: Your current IP address is not whitelisted in Atlas Network Access.
- **Fix**: In the Atlas Console $\rightarrow$ **Network Access** $\rightarrow$ add `0.0.0.0/0` (Allow Access from Anywhere) for development.

---

### Issue 4: Atlas Vector Search Returns 0 Results
- **Symptom**: Semantic queries return no results or fall back to keyword search.
- **Causes**:
  - The Vector Search index `vector_index` is still building in the Atlas Console (takes 1–2 minutes).
  - The collection name in the index definition was set incorrectly (must be `lecture_chunks`).
  - All lectures are unpublished (`is_published: false`), and queries are executed as a student.
- **Fix**:
  1. Verify in Atlas Search that `vector_index` has status **Active**.
  2. As a teacher, click **Approve & Publish to Students** on the lecture review page.

---

## 3. Ingestion & AI Pipeline Issues

### Issue 1: `Captions unavailable for this YouTube video`
- **Symptom**: Ingesting a YouTube link fails or logs caption unavailability.
- **Cause**: The YouTube video has subtitles/CC disabled by the creator, or is region-restricted.
- **Fix**: Upload the recording file (`.mp4`, `.mp3`) directly via the **Upload Audio / Video** tab on the Add Lecture page.

---

### Issue 2: Q&A Returns *"The available lecture materials do not contain sufficient evidence"*
- **Symptom**: The Q&A system returns an abstention message.
- **Cause**: This is the intended behavior of the **Responsible AI Abstention Gate**. If the question is outside the scope of the course or does not match any lecture content with $\ge 0.30$ cosine similarity, the model abstains rather than hallucinating.
- **Fix**: Ask questions that specifically reference concepts covered in the lecture (e.g. *"What is self-attention?"* or *"Explain backpropagation"*).

