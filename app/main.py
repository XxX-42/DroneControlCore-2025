from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

# 1. Import connection manager
from app.infrastructure.mavsdk.connection import mavsdk_manager

# 2. Import routers (Only missions for now)
from app.api.routers import missions

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initializing Drone Control System...")
    print(">>> Loading v2.1 - System Restored <<<")
    # Initialize MAVSDK connection (non blocking)
    asyncio.create_task(mavsdk_manager.connect())
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(title="Drone Control System", lifespan=lifespan)

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Mount Routers
app.include_router(missions.router, prefix="/api/v1/missions", tags=["Missions"])

@app.get("/")
async def root():
    return {"message": "Drone Control System API is running"}