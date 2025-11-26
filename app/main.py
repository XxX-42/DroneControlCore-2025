from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.infrastructure.mavsdk.connection import mavsdk_manager
from app.api.routers import missions, telemetry, vision
from app.infrastructure.database.db import engine, Base
from app.infrastructure.database import models

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> System Starting...")
    
    # Initialize DB Tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Initialize MAVSDK connection (non blocking)
    asyncio.create_task(mavsdk_manager.connect())
    yield
    print(">>> System Shutting Down...")

app = FastAPI(title="Drone Control System", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(missions.router, prefix="/api/v1/missions", tags=["Missions"])
app.include_router(telemetry.router, tags=["Telemetry"])
app.include_router(vision.router, prefix="/vision", tags=["Vision"])

@app.get("/")
async def root():
    return {"message": "System Online"}