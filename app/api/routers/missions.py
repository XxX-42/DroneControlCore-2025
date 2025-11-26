from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import uuid
from datetime import datetime
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.infrastructure.mavsdk.mission_service import mavsdk_mission_service
from app.infrastructure.mavsdk.connection import mavsdk_manager
from app.infrastructure.database.db import get_db
from app.infrastructure.database.models import MissionModel
from app.domain.mission import Mission, Waypoint
from app.core.drone_state import drone_state

router = APIRouter()

class WaypointDTO(BaseModel):
    latitude: float
    longitude: float
    relative_altitude: float
    speed_m_s: float

class MissionDTO(BaseModel):
    name: str
    waypoints: List[WaypointDTO]

@router.post("/upload")
async def upload_mission(mission_data: MissionDTO, db: AsyncSession = Depends(get_db)):
    try:
        # Convert DTO to Domain Entities
        domain_waypoints = [
            Waypoint(
                latitude=wp.latitude,
                longitude=wp.longitude,
                relative_altitude=wp.relative_altitude,
                speed_m_s=wp.speed_m_s
            ) for wp in mission_data.waypoints
        ]
        
        domain_mission = Mission(
            id=uuid.uuid4(),
            name=mission_data.name,
            waypoints=domain_waypoints,
            created_at=datetime.utcnow(),
            status="UPLOADED"
        )

        # 1. Upload to Drone (Hardware/Sim)
        if mavsdk_manager.system:
            await mavsdk_mission_service.upload_mission(mavsdk_manager.system, domain_mission)
        else:
            print("⚠️ Drone system not connected. Skipping hardware upload.")
        
        # 2. Update Physics Engine Target
        if mission_data.waypoints:
            last_wp = mission_data.waypoints[-1]
            drone_state.target_lat = last_wp.latitude
            drone_state.target_lon = last_wp.longitude
            print(f">>> New Target Set: {drone_state.target_lat}, {drone_state.target_lon}")

        # 3. Persist to Database
        mission_entry = MissionModel(
            name=mission_data.name,
            status="UPLOADED",
            waypoints_json=json.dumps([wp.dict() for wp in mission_data.waypoints])
        )
        db.add(mission_entry)
        await db.commit()
        
        return {"message": f"Mission '{mission_data.name}' uploaded and saved."}
    except Exception as e:
        print(f"Error uploading mission: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_mission_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MissionModel).order_by(MissionModel.timestamp.desc()))
    missions = result.scalars().all()
    return missions
