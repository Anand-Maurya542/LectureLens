import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import connect_to_mongo, close_mongo_connection, db
from app.dependencies.auth import seed_default_users


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    await connect_to_mongo()
    await seed_default_users()
    yield
    await close_mongo_connection()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

