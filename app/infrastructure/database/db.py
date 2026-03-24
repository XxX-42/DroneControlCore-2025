from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.settings import settings

engine = create_async_engine(settings.db_url, echo=settings.sql_echo)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def init_db():
    import app.infrastructure.database.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        result = await conn.execute(text("PRAGMA table_info(missions)"))
        columns = {row[1] for row in result.fetchall()}
        if "mission_uuid" not in columns:
            await conn.execute(text("ALTER TABLE missions ADD COLUMN mission_uuid VARCHAR"))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
