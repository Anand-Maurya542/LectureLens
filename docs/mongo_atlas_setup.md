# MongoDB Atlas & Vector Search Setup Guide

This guide describes how to configure MongoDB Atlas and create the required **Atlas Vector Search** index for LectureLens.

---

## 1. Create a MongoDB Atlas Cluster

1. Sign up or log into [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create an **M0 Free Tier** (or higher) cluster in your preferred region.
3. In **Database Access**, create a database user (e.g. `lecturelens_admin`) with read/write privileges.
4. In **Network Access**, add your current IP address (or `0.0.0.0/0` for initial development).
5. In **Database Deployment**, click **Connect** -> **Drivers** -> **Python**, and copy your connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
   ```
6. Paste this URI into your `.env` and `backend/.env`:
   ```bash
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=lecturelens_db
   ```

---

## 2. Atlas Vector Search Index Definition

LectureLens utilizes dense 384-dimensional multilingual sentence embeddings (`paraphrase-multilingual-MiniLM-L12-v2`) stored in the `lecture_chunks` collection.

### Creating the Index in MongoDB Atlas UI

1. Open your cluster in the MongoDB Atlas Web Console.
2. Navigate to **Atlas Search** (or **Search & Vector Search**).
3. Click **Create Search Index**.
4. Choose **JSON Editor** under **Atlas Vector Search**.
5. Select the Database: `lecturelens_db` and Collection: `lecture_chunks`.
6. Set the Index Name to: `vector_index`.
7. Paste the following JSON configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "course_id"
    },
    {
      "type": "filter",
      "path": "lecture_id"
    },
    {
      "type": "filter",
      "path": "is_published"
    }
  ]
}
```

8. Click **Create Search Index**. The index build will take 1–2 minutes.

---

## 3. How LectureLens Executes `$vectorSearch`

When searching, `app.services.vector_search` executes this aggregation stage against your Atlas cluster:

```python
pipeline = [
    {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_384d_embedding,
            "numCandidates": 50,
            "limit": 5,
            "filter": {
                "is_published": True,
                "course_id": target_course_id
            }
        }
    },
    {
        "$project": {
            "_id": 1,
            "lecture_id": 1,
            "course_id": 1,
            "topic_id": 1,
            "topic_title": 1,
            "start": 1,
            "end": 1,
            "text": 1,
            "score": {"$meta": "vectorSearchScore"}
        }
    }
]
```

---

## 4. Local Development Fallback

If `MONGODB_URI` is not set or you are testing offline, LectureLens automatically falls back to asynchronous local testing mode (`mongomock-motor`) and computes unit-normalized cosine similarity locally. No code changes or special flags are required.

