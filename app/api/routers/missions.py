import json
from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.mission import Mission, MissionStatus, Waypoint
from app.domain.mission_execution import ExecutionStatus
from app.infrastructure.database.db import get_db
from app.infrastructure.database.models import MissionExecutionModel, MissionModel
from app.services.execution_service import execution_service
from app.services.mission_state_machine import mission_state_machine

router = APIRouter()


class WaypointDTO(BaseModel):
    latitude: float
    longitude: float
    relative_altitude: float
    speed_m_s: float


class MissionDTO(BaseModel):
    name: str
    waypoints: List[WaypointDTO]


def serialize_execution(execution: MissionExecutionModel) -> dict:
    return {
        "execution_id": execution.execution_uuid,
        "mission_id": execution.mission_uuid,
        "mode": execution.mode,
        "status": execution.status,
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "ended_at": execution.ended_at.isoformat() if execution.ended_at else None,
        "error_message": execution.error_message,
        "trace": json.loads(execution.trace_json or "[]"),
    }


async def reconcile_mission_records(
    db: AsyncSession,
    mission: MissionModel,
    executions: list[MissionExecutionModel],
):
    changed = False
    for execution in executions:
        changed = await execution_service.reconcile_simulation_state(mission, execution) or changed
    if changed:
        await db.commit()


@router.get("/history")
async def mission_history(db: AsyncSession = Depends(get_db)):
    mission_result = await db.execute(
        select(MissionModel).order_by(MissionModel.timestamp.desc())
    )
    execution_result = await db.execute(select(MissionExecutionModel))

    missions = mission_result.scalars().all()
    executions = execution_result.scalars().all()

    execution_map = {}
    for execution in executions:
        execution_map.setdefault(execution.mission_uuid, []).append(serialize_execution(execution))

    for mission in missions:
        mission_executions = [execution for execution in executions if execution.mission_uuid == mission.mission_uuid]
        await reconcile_mission_records(db, mission, mission_executions)

    return [
        {
            "id": mission.mission_uuid or str(mission.id),
            "name": mission.name,
            "timestamp": mission.timestamp.isoformat() if mission.timestamp else None,
            "status": mission.status,
            "waypoints": json.loads(mission.waypoints_json or "[]"),
            "executions": execution_map.get(mission.mission_uuid, []),
        }
        for mission in missions
    ]


@router.get("/{mission_id}")
async def mission_detail(mission_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionModel).where(MissionModel.mission_uuid == mission_id)
    )
    mission = result.scalar_one_or_none()
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    execution_result = await db.execute(
        select(MissionExecutionModel).where(MissionExecutionModel.mission_uuid == mission_id)
    )
    executions = execution_result.scalars().all()
    await reconcile_mission_records(db, mission, executions)

    return {
        "id": mission.mission_uuid,
        "name": mission.name,
        "timestamp": mission.timestamp.isoformat() if mission.timestamp else None,
        "status": mission.status,
        "waypoints": json.loads(mission.waypoints_json or "[]"),
        "executions": [serialize_execution(execution) for execution in executions],
    }


@router.get("/executions/{execution_id}")
async def execution_detail(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionExecutionModel).where(
            MissionExecutionModel.execution_uuid == execution_id
        )
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")

    mission_result = await db.execute(
        select(MissionModel).where(MissionModel.mission_uuid == execution.mission_uuid)
    )
    mission = mission_result.scalar_one_or_none()
    if mission is not None:
        await reconcile_mission_records(db, mission, [execution])

    return serialize_execution(execution)


@router.post("/upload")
async def upload_mission(
    mission_data: MissionDTO,
    db: AsyncSession = Depends(get_db),
):
    mission_id = uuid4()
    execution_id = uuid4()

    domain_waypoints = [
        Waypoint(
            latitude=wp.latitude,
            longitude=wp.longitude,
            relative_altitude=wp.relative_altitude,
            speed_m_s=wp.speed_m_s,
        )
        for wp in mission_data.waypoints
    ]

    domain_mission = Mission(
        id=mission_id,
        name=mission_data.name,
        waypoints=domain_waypoints,
        created_at=datetime.now(),
        status=MissionStatus.DRAFT,
    )

    mission_model = MissionModel(
        mission_uuid=str(mission_id),
        name=domain_mission.name,
        timestamp=domain_mission.created_at,
        status=domain_mission.status.value,
        waypoints_json=json.dumps([waypoint.dict() for waypoint in mission_data.waypoints]),
    )
    db.add(mission_model)

    try:
        result = await execution_service.execute_mission(domain_mission)
        mission_model.status = mission_state_machine.transition_mission(
            MissionStatus(mission_model.status),
            MissionStatus(result["mission_status"]),
        ).value
        db.add(
            MissionExecutionModel(
                execution_uuid=str(execution_id),
                mission_uuid=str(mission_id),
                mode=result["mode"],
                status=result["execution_status"],
                started_at=datetime.now(),
                trace_json="[]",
            )
        )
        execution_service.bind_simulation_execution(str(mission_id), str(execution_id))
        await db.commit()
        return {
            "status": "success",
            "mission_id": str(mission_id),
            "execution_id": str(execution_id),
            "message": f"Mission '{domain_mission.name}' accepted successfully",
            "mission_status": mission_model.status,
            "execution_status": result["execution_status"],
        }
    except Exception as exc:
        await db.rollback()
        db.add(mission_model)
        mission_model.status = mission_state_machine.transition_mission(
            MissionStatus(mission_model.status),
            MissionStatus.FAILED,
        ).value
        db.add(
            MissionExecutionModel(
                execution_uuid=str(execution_id),
                mission_uuid=str(mission_id),
                mode="unknown",
                status=ExecutionStatus.FAILED.value,
                started_at=datetime.now(),
                ended_at=datetime.now(),
                error_message=str(exc),
                trace_json="[]",
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Mission upload failed: {exc}",
        ) from exc


@router.post("/executions/{execution_id}/pause")
async def pause_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionExecutionModel).where(MissionExecutionModel.execution_uuid == execution_id)
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")

    mission_result = await db.execute(
        select(MissionModel).where(MissionModel.mission_uuid == execution.mission_uuid)
    )
    mission = mission_result.scalar_one_or_none()
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    execution_status, mission_status = await execution_service.pause_execution(mission, execution)
    await db.commit()
    return {
        "status": "success",
        "execution_id": execution_id,
        "execution_status": execution_status,
        "mission_status": mission_status,
    }


@router.post("/executions/{execution_id}/resume")
async def resume_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionExecutionModel).where(MissionExecutionModel.execution_uuid == execution_id)
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")

    mission_result = await db.execute(
        select(MissionModel).where(MissionModel.mission_uuid == execution.mission_uuid)
    )
    mission = mission_result.scalar_one_or_none()
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    execution_status, mission_status = await execution_service.resume_execution(mission, execution)
    await db.commit()
    return {
        "status": "success",
        "execution_id": execution_id,
        "execution_status": execution_status,
        "mission_status": mission_status,
    }


@router.post("/executions/{execution_id}/cancel")
async def cancel_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MissionExecutionModel).where(MissionExecutionModel.execution_uuid == execution_id)
    )
    execution = result.scalar_one_or_none()
    if execution is None:
        raise HTTPException(status_code=404, detail="Execution not found")

    mission_result = await db.execute(
        select(MissionModel).where(MissionModel.mission_uuid == execution.mission_uuid)
    )
    mission = mission_result.scalar_one_or_none()
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    execution_status, mission_status = await execution_service.cancel_execution(mission, execution)
    await db.commit()
    return {
        "status": "success",
        "execution_id": execution_id,
        "execution_status": execution_status,
        "mission_status": mission_status,
    }
