import datetime
import logging
import ssl
from typing import Any, Optional
from bson import ObjectId
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

# Fix macOS LibreSSL 2.8.3 session ticket & TLS 1.3 bug:
# Python on macOS built with LibreSSL fails TLS 1.3 session ticket resumption with:
# '[SSL: BAD_PSK_IDENTITY] bad message type (_ssl.c:1129)'.
# When this happens, PyMongo marks the shard down and pauses the connection pool.
# We cap the TLS protocol to TLS 1.2 across all PyMongo SSL contexts and wrap_socket calls,
# and disable TLS session caching completely to ensure clean, stable handshakes on every socket.
try:
    import pymongo.ssl_support
    _orig_get_ssl_context = pymongo.ssl_support.get_ssl_context
    def _safe_get_ssl_context(*args, **kwargs):
        ctx = _orig_get_ssl_context(*args, **kwargs)
        if hasattr(ctx, "maximum_version") and hasattr(ssl, "TLSVersion"):
            try:
                ctx.maximum_version = ssl.TLSVersion.TLSv1_2
            except Exception:
                pass
        return ctx
    pymongo.ssl_support.get_ssl_context = _safe_get_ssl_context
except Exception:
    pass

try:
    import pymongo.pool_shared
    pymongo.pool_shared._get_ssl_session = lambda *args, **kwargs: None
except Exception:
    pass

_orig_wrap_socket = ssl.SSLContext.wrap_socket
def _safe_wrap_socket(self, *args, **kwargs):
    if hasattr(self, "maximum_version") and hasattr(ssl, "TLSVersion"):
        try:
            self.maximum_version = ssl.TLSVersion.TLSv1_2
        except Exception:
            pass
    kwargs.pop("session", None)
    if len(args) >= 6:
        args = args[:5] + (None,) + args[6:]
    return _orig_wrap_socket(self, *args, **kwargs)
ssl.SSLContext.wrap_socket = _safe_wrap_socket

logger = logging.getLogger("lecturelens.database")

class Database:
    client: Optional[Any] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_mock: bool = False

db = Database()


def serialize_doc(doc: Optional[Any]) -> Optional[Any]:
    """Recursively converts MongoDB ObjectIds, datetimes and BSON types to JSON serializable Python types."""
    if doc is None:
        return None
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, (datetime.datetime, datetime.date)):
        return doc.isoformat()
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if not isinstance(doc, dict):
        return doc

    res = {}
    for key, value in doc.items():
        if key == "_id":
            res["id"] = str(value)
            res["_id"] = str(value)
        elif isinstance(value, ObjectId):
            res[key] = str(value)
        elif isinstance(value, (datetime.datetime, datetime.date)):
            res[key] = value.isoformat()
        elif isinstance(value, list):
            res[key] = [serialize_doc(item) for item in value]
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
            logger.info("Connecting to MongoDB Atlas with certifi CA bundle...")
            db.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=True,
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=20000,
                minPoolSize=1,
                maxPoolSize=10,
                maxIdleTimeMS=30000,
                retryWrites=True,
                retryReads=True,
                uuidRepresentation="standard",
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
        await db.db.courses.create_index("teacher_ids")
        await db.db.courses.create_index("code", unique=True)
        await db.db.courses.create_index("student_ids")
        await db.db.courses.create_index("status")

        # Course enrollments indexes
        await db.db.course_enrollments.create_index([("course_id", 1), ("user_id", 1)], unique=True)
        await db.db.course_enrollments.create_index("status")
        await db.db.course_enrollments.create_index("user_id")
        await db.db.course_enrollments.create_index("course_id")

        # Notifications indexes
        await db.db.notifications.create_index("user_id")
        await db.db.notifications.create_index("created_at")

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

        # Teacher applications indexes
        await db.db.teacher_applications.create_index("email")
        await db.db.teacher_applications.create_index("status")
        logger.info("MongoDB database indexes initialized successfully.")
    except Exception as e:
        logger.warning(f"Notice on index creation: {e}")


def get_db() -> AsyncIOMotorDatabase:
    if db.db is None:
        logger.warning("Database client requested before asynchronous startup initialization. Initializing fallback...")
        try:
            from mongomock_motor import AsyncMongoMockClient
            db.client = AsyncMongoMockClient()
            db.db = db.client[settings.MONGODB_DB_NAME]
            db.is_mock = True
        except Exception as e:
            logger.error(f"Failed to initialize fallback database: {e}")
            raise RuntimeError(f"Database is not initialized: {e}")
    return db.db

