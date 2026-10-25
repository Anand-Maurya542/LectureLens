import logging
from typing import Any, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("lecturelens.database")

class Database:
    client: Optional[Any] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_mock: bool = False

db = Database()


def serialize_doc(doc: Optional[dict]) -> Optional[dict]:
    """Recursively converts MongoDB ObjectIds and BSON types to JSON serializable Python types."""
    if doc is None:
        return None
    res = {}
    for key, value in doc.items():
        if key == "_id":
            res["id"] = str(value)
            res["_id"] = str(value)
        elif isinstance(value, ObjectId):
            res[key] = str(value)
        elif isinstance(value, list):
            res[key] = [
                serialize_doc(item) if isinstance(item, dict)
                else str(item) if isinstance(item, ObjectId)
                else item
                for item in value
            ]
        elif isinstance(value, dict):
            res[key] = serialize_doc(value)
        else:
            res[key] = value
    return res


def serialize_list(docs: list[dict]) -> list[dict]:
    return [serialize_doc(doc) for doc in docs if doc is not None]


async def connect_to_mongo():
    logger.info("Initializing MongoDB connection...")
    
    if settings.MONGODB_URI:
        try:
            logger.info("Connecting to MongoDB Atlas at configured URI...")
            db.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                uuidRepresentation="standard"
            )
            # Verify connectivity
            await db.client.admin.command("ping")
            db.db = db.client[settings.MONGODB_DB_NAME]
            db.is_mock = False
            logger.info(f"Connected to MongoDB Atlas: database '{settings.MONGODB_DB_NAME}'")
        except Exception as e:
            logger.warning(
                f"Failed to connect to configured MongoDB URI ({e}). Falling back to local in-memory mock client for development."
            )
            from mongomock_motor import AsyncMongoMockClient
            db.client = AsyncMongoMockClient()
            db.db = db.client[settings.MONGODB_DB_NAME]
            db.is_mock = True
    else:
        logger.info(
            "MONGODB_URI not configured in .env. Initializing local asynchronous development database (mongomock)."
        )
        from mongomock_motor import AsyncMongoMockClient
        db.client = AsyncMongoMockClient()
        db.db = db.client[settings.MONGODB_DB_NAME]
        db.is_mock = True

    await init_indexes()


async def close_mongo_connection():
    if db.client:
        logger.info("Closing MongoDB connection...")
        db.client.close()
        logger.info("MongoDB connection closed.")


async def init_indexes():
    """Ensure essential indexes exist for all core collections."""
    if db.db is None:
        return
    try:
        # Users indexes
        await db.db.users.create_index("email", unique=True)
        await db.db.users.create_index("role")

        # Courses indexes
        await db.db.courses.create_index("teacher_id")
        await db.db.courses.create_index("code", unique=True)
        await db.db.courses.create_index("student_ids")

        # Lectures indexes
        await db.db.lectures.create_index("course_id")
        await db.db.lectures.create_index("teacher_id")
        await db.db.lectures.create_index("status")
        await db.db.lectures.create_index("is_published")

        # Transcript segments indexes
        await db.db.transcript_segments.create_index([("lecture_id", 1), ("segment_index", 1)])

        # Topics indexes
        await db.db.topics.create_index([("lecture_id", 1), ("topic_index", 1)])

        # Summaries indexes
        await db.db.summaries.create_index("lecture_id")

        # Lecture chunks indexes (vector + keyword search)
        await db.db.lecture_chunks.create_index([("lecture_id", 1), ("chunk_index", 1)])
        await db.db.lecture_chunks.create_index("course_id")
        await db.db.lecture_chunks.create_index("is_published")

        # Quizzes indexes
        await db.db.quizzes.create_index("lecture_id")
        await db.db.quizzes.create_index("is_approved")

        # Quiz attempts indexes
        await db.db.quiz_attempts.create_index("student_id")
        await db.db.quiz_attempts.create_index("lecture_id")

        # Audit logs indexes
        await db.db.audit_logs.create_index([("entity_type", 1), ("entity_id", 1)])
        await db.db.audit_logs.create_index("timestamp")
        logger.info("MongoDB database indexes initialized successfully.")
    except Exception as e:
        logger.warning(f"Notice on index creation: {e}")


def get_db() -> AsyncIOMotorDatabase:
    if db.db is None:
        raise RuntimeError("Database is not initialized. Check application lifecycle.")
    return db.db

