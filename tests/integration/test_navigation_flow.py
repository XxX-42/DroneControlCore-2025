from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.drone_state import drone_state
from app.core.settings import AppMode, settings
from app.domain.mission import Mission, MissionStatus, Waypoint
from app.domain.mission_execution import ExecutionStatus
from app.infrastructure.mavsdk.mission_service import MavsdkMissionService
from app.infrastructure.navigation.path_planner import path_planner
from app.main import app
from app.services.execution_service import execution_service
from app.services.mission_state_machine import mission_state_machine

client = TestClient(app)


def test_navigation_plan_endpoint_returns_route(monkeypatch):
    async def fake_plan_path(start_lat, start_lon, end_lat, end_lon):
        return {
            "route_type": "direct",
            "fallback_used": True,
            "waypoints": [
                {"latitude": start_lat, "longitude": start_lon, "is_user_target": False},
                {"latitude": end_lat, "longitude": end_lon, "is_user_target": True},
            ],
        }

    monkeypatch.setattr(path_planner, "plan_path", fake_plan_path)

    response = client.post(
        "/api/v1/navigation/plan",
        json={
            "start_latitude": 30.598,
            "start_longitude": 103.991,
            "target_latitude": 30.6,
            "target_longitude": 103.995,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["route_type"] == "direct"
    assert payload["fallback_used"] is True
    assert payload["waypoints"][-1]["is_user_target"] is True


def test_mission_plan_builder_keeps_waypoint_order():
    service = MavsdkMissionService()
    mission = Mission(
        id=uuid4(),
        name="Planned Route",
        waypoints=[
            Waypoint(latitude=30.598, longitude=103.991, relative_altitude=50.0, speed_m_s=10.0),
            Waypoint(latitude=30.599, longitude=103.992, relative_altitude=50.0, speed_m_s=10.0),
            Waypoint(latitude=30.6, longitude=103.993, relative_altitude=50.0, speed_m_s=10.0),
        ],
        created_at=datetime.now(),
        status=MissionStatus.DRAFT,
    )

    mission_plan = service.build_mission_plan(mission)

    assert len(mission_plan.mission_items) == 3
    assert mission_plan.mission_items[0].latitude_deg == mission.waypoints[0].latitude
    assert mission_plan.mission_items[-1].longitude_deg == mission.waypoints[-1].longitude


@pytest.mark.asyncio
async def test_execution_service_uses_simulation_mode(monkeypatch):
    mission = Mission(
        id=uuid4(),
        name="Simulation Route",
        waypoints=[
            Waypoint(latitude=30.598, longitude=103.991, relative_altitude=50.0, speed_m_s=10.0),
            Waypoint(latitude=30.6, longitude=103.993, relative_altitude=50.0, speed_m_s=10.0),
        ],
        created_at=datetime.now(),
        status=MissionStatus.DRAFT,
    )

    monkeypatch.setattr(settings, "app_mode", AppMode.SIMULATION)
    drone_state.set_mission([])

    result = await execution_service.execute_mission(mission)

    assert result["mission_status"] == MissionStatus.EXECUTING.value
    assert result["execution_status"] == "RUNNING"
    assert len(drone_state.waypoint_queue) == 2
    assert drone_state.waypoint_queue[-1]["is_user_target"] is True


@pytest.mark.asyncio
async def test_execution_service_requires_connection_in_hardware_mode(monkeypatch):
    mission = Mission(
        id=uuid4(),
        name="Hardware Route",
        waypoints=[
            Waypoint(latitude=30.598, longitude=103.991, relative_altitude=50.0, speed_m_s=10.0),
        ],
        created_at=datetime.now(),
        status=MissionStatus.DRAFT,
    )

    monkeypatch.setattr(settings, "app_mode", AppMode.HARDWARE)

    with pytest.raises(HTTPException) as exc_info:
        await execution_service.execute_mission(mission)

    assert exc_info.value.status_code == 503


def test_state_machine_rejects_invalid_mission_transition():
    with pytest.raises(ValueError):
        mission_state_machine.transition_mission(
            MissionStatus.COMPLETED,
            MissionStatus.EXECUTING,
        )


def test_state_machine_rejects_invalid_execution_transition():
    with pytest.raises(ValueError):
        mission_state_machine.transition_execution(
            ExecutionStatus.COMPLETED,
            ExecutionStatus.RUNNING,
        )
