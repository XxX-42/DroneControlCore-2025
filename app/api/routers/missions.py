import json
from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.mission import Mission, Waypoint
from app.infrastructure.database.db import get_db
from app.infrastructure.database.models import MissionModel
from app.infrastructure.mavsdk.connection import mavsdk_manager
from app.infrastructure.mavsdk.mission_service import MavsdkMissionService

router = APIRouter()


class WaypointDTO(BaseModel):
    latitude: float
    longitude: float
    relative_altitude: float
    speed_m_s: float


class MissionDTO(BaseModel):
    name: str
    waypoints: List[WaypointDTO]


@router.get("/history")
async def mission_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionModel).order_by(MissionModel.timestamp.desc())
    )
    missions = result.scalars().all()
    return [
        {
            "id": mission.id,
            "name": mission.name,
            "timestamp": mission.timestamp.isoformat() if mission.timestamp else None,
            "status": mission.status,
            "waypoints": json.loads(mission.waypoints_json or "[]"),
        }
        for mission in missions
    ]


@router.post("/upload")
async def upload_mission(
    mission_data: MissionDTO,
    db: AsyncSession = Depends(get_db),
):
    if not mavsdk_manager.system:
        raise HTTPException(status_code=503, detail="Drone not connected")

    domain_waypoints = [
        Waypoint(
            latitude=wp.latitude,
            longitude=wp.longitude,
            relative_altitude=wp.relative_altitude,
            speed_m_s=wp.speed_m_s,
        )
        for wp in mission_data.waypoints
    ]

    mission_id = uuid4()
    domain_mission = Mission(
        id=mission_id,
        name=mission_data.name,
        waypoints=domain_waypoints,
        created_at=datetime.now(),
        status="DRAFT",
    )

    service = MavsdkMissionService()

    try:
        await service.upload_mission(mavsdk_manager.system, domain_mission)
        db.add(
            MissionModel(
                name=domain_mission.name,
                timestamp=domain_mission.created_at,
                status="UPLOADED",
                waypoints_json=json.dumps(
                    [waypoint.dict() for waypoint in mission_data.waypoints]
                ),
            )
        )
        await db.commit()
        return {
            "status": "success",
            "mission_id": str(mission_id),
            "message": f"Mission '{domain_mission.name}' uploaded successfully",
        }
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Mission upload failed: {exc}",
        ) from exc
