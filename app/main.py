import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import configure_logging
from app.core.settings import AppMode, settings
from app.api.routers import missions, navigation, telemetry, vision
from app.infrastructure.database.db import init_db
from app.infrastructure.mavsdk.connection import mavsdk_manager

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Initializing Drone Control System mode=%s db=%s osm_radius_m=%s",
        settings.app_mode.value,
        settings.db_url,
        settings.osm_radius_m,
    )
    await init_db()
    if settings.app_mode != AppMode.SIMULATION:
        asyncio.create_task(mavsdk_manager.connect())

    from app.core.drone_state import drone_state

    physics_task = asyncio.create_task(drone_state.start_physics_loop())

    yield

    logger.info("Shutting down...")
    physics_task.cancel()
    try:
        await physics_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Drone Control System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(missions.router, prefix="/api/v1/missions", tags=["Missions"])
app.include_router(navigation.router, prefix="/api/v1/navigation", tags=["Navigation"])
app.include_router(telemetry.router, tags=["Telemetry"])
app.include_router(vision.router, prefix="/api/v1/vision", tags=["Vision"])


@app.get("/")
async def root():
    return {"message": "System Online"}
