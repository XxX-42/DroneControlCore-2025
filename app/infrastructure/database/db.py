from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.settings import settings

engine = create_async_engine(settings.db_url, echo=settings.sql_echo)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def ensure_schema(conn):
    await conn.run_sync(Base.metadata.create_all)
    result = await conn.execute(text("PRAGMA table_info(missions)"))
    columns = {row[1] for row in result.fetchall()}
    if "mission_uuid" not in columns:
        await conn.execute(text("ALTER TABLE missions ADD COLUMN mission_uuid VARCHAR"))
    execution_result = await conn.execute(text("PRAGMA table_info(mission_executions)"))
    execution_columns = {row[1] for row in execution_result.fetchall()}
    if "trace_json" not in execution_columns:
        await conn.execute(text("ALTER TABLE mission_executions ADD COLUMN trace_json TEXT"))


async def init_db():
    import app.infrastructure.database.models  # noqa: F401

    async with engine.begin() as conn:
        await ensure_schema(conn)


async def get_db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT 1"))
        await ensure_schema(await session.connection())
        yield session
