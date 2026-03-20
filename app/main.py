import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import missions, telemetry, vision
from app.infrastructure.database.db import init_db
from app.infrastructure.mavsdk.connection import mavsdk_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Drone Control System...")
    print(">>> Loading v2.1 - System Restored <<<")
    await init_db()
    asyncio.create_task(mavsdk_manager.connect())

    from app.core.drone_state import drone_state

    physics_task = asyncio.create_task(drone_state.start_physics_loop())

    yield

    print("Shutting down...")
    physics_task.cancel()
    try:
        await physics_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Drone Control System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(missions.router, prefix="/api/v1/missions", tags=["Missions"])
app.include_router(telemetry.router, tags=["Telemetry"])
app.include_router(vision.router, prefix="/api/v1/vision", tags=["Vision"])


@app.get("/")
async def root():
    return {"message": "System Online"}
