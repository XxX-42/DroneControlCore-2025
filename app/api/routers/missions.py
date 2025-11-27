from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from uuid import uuid4
from datetime import datetime

from app.domain.mission import Mission, Waypoint
from app.infrastructure.mavsdk.mission_service import MavsdkMissionService
from app.infrastructure.mavsdk.connection import mavsdk_manager

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
async def upload_mission(mission_data: MissionDTO):
    """
    Uploads a mission to the drone via MAVSDK.
    """
    if not mavsdk_manager.system:
        raise HTTPException(status_code=503, detail="Drone not connected")

    # Convert DTO to Domain Entity
    domain_waypoints = [
        Waypoint(
            latitude=wp.latitude,
            longitude=wp.longitude,
            relative_altitude=wp.relative_altitude,
            speed_m_s=wp.speed_m_s
        ) for wp in mission_data.waypoints
    ]

    mission_id = uuid4()
    domain_mission = Mission(
        id=mission_id,
        name=mission_data.name,
        waypoints=domain_waypoints,
        created_at=datetime.now(),
        status="DRAFT"
    )

    # Instantiate Service
    service = MavsdkMissionService()
    
    try:
        await service.upload_mission(mavsdk_manager.system, domain_mission)
        return {
            "status": "success", 
            "mission_id": str(mission_id),
            "message": f"Mission '{domain_mission.name}' uploaded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mission upload failed: {str(e)}")
