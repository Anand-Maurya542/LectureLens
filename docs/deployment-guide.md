# Production Deployment Guide

## 1. Overview & Architecture

LectureLens is containerized using Docker and orchestrated with Docker Compose. In production, requests flow through an Nginx reverse proxy to the FastAPI backend and React frontend.

```mermaid
graph LR
    INTERNET["Clients (Browser)"] -->|HTTPS (Port 443)| NGINX["Nginx Gateway"]
    NGINX -->|/ -> Static Files| FRONTEND["React Static Build"]
    NGINX -->|/api/* -> Reverse Proxy| BACKEND["FastAPI Container (Port 8000)"]
    BACKEND -->|Storage Volume| MEDIA["Mounted Volume (/app/data/uploads)"]
    BACKEND -->|TLS Connection| ATLAS["MongoDB Atlas Cluster ($vectorSearch)"]
```

---

## 2. Docker & Compose Configuration

The repository includes ready-to-use Dockerfiles and a Compose file:

- [`backend/Dockerfile`](file:///Users/ananadmauya/Projects/lecturelens/backend/Dockerfile): Python 3.9-slim image with system FFmpeg and build essentials.
- [`frontend/Dockerfile`](file:///Users/ananadmauya/Projects/lecturelens/frontend/Dockerfile): Multi-stage build (Node.js 20-alpine build stage + Nginx-alpine serving stage).
- [`frontend/nginx.conf`](file:///Users/ananadmauya/Projects/lecturelens/frontend/nginx.conf): Serves the React SPA with `try_files $uri /index.html;` and proxies `/api/` to `http://backend:8000`.
- [`docker-compose.yml`](file:///Users/ananadmauya/Projects/lecturelens/docker-compose.yml): Coordinates both services with persistent volume storage for media files.

### Deploying with Docker Compose:
```bash
# 1. Provide production environment variables
export MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority"
export SECRET_KEY="your-secure-random-32byte-jwt-secret-key"

# 2. Build and start containers in detached mode
docker-compose up --build -d

# 3. View container logs
docker-compose logs -f
```

---

## 3. Production Environment Checklist

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `APP_ENV` | `production` | Sets application mode |
| `SECRET_KEY` | `f8c4b9...` (generate via `openssl rand -hex 32`) | Critical for signing JWT access tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token expiration window |
| `ALLOWED_ORIGINS` | `https://lecturelens.yourdomain.edu` | Restricts CORS access to trusted domains |
| `MONGODB_URI` | `mongodb+srv://...` | Connection URI for MongoDB Atlas |
| `MONGODB_DB_NAME` | `lecturelens_db` | Target MongoDB database |
| `MEDIA_UPLOAD_DIR` | `/app/data/uploads` | Path to persistent storage volume |
| `ATLAS_VECTOR_INDEX_NAME` | `vector_index` | Name of Atlas Vector Search index |
| `EMBEDDING_MODEL_NAME` | `paraphrase-multilingual-MiniLM-L12-v2` | Embedding model identifier |
| `WHISPER_MODEL_SIZE` | `small` | Faster-Whisper model variant |
| `WHISPER_COMPUTE_TYPE` | `int8` | Inference quantization mode |

---

## 4. Persistent Storage & Object Storage

- In the default Docker setup, media uploads are mounted from the host at `./data/uploads:/app/data/uploads`.
- For multi-instance horizontal scaling (e.g. Kubernetes, AWS ECS, or Render), replace local disk storage with cloud object storage (e.g., AWS S3, Google Cloud Storage, or MinIO) using pre-signed URLs.

---

## 5. Atlas Vector Search Index Verification

Before routing traffic, ensure the Vector Search index is active:
1. In the Atlas Web Console $\rightarrow$ **Atlas Search** $\rightarrow$ verify that `vector_index` on `lecturelens_db.lecture_chunks` shows status **Active**.
2. If the index is still building, vector searches will temporarily fall back to local cosine calculation.

---

## 6. Health Checks & Monitoring

- **Application Health Check**: `GET /health` returns:
  ```json
  {"status": "ok", "database_mode": "mongodb_atlas"}
  ```
- **Uptime Monitoring**: Configure an external ping (e.g. AWS Route53 Health Check, Better Uptime) targeting `https://<yourdomain>/health`.

