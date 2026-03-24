import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "System Online"}


@pytest.mark.asyncio
async def test_history_endpoint():
    response = client.get("/api/v1/missions/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_status_endpoint():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json() == {"status": "Active"}


def test_speed_endpoint():
    response = client.post("/speed", json={"speed": 2.5})
    assert response.status_code == 200
    assert response.json() == {"message": "Speed set to 2.5"}


def test_mission_upload_returns_execution_id():
    payload = {
        "name": "Mission API Test",
        "waypoints": [
            {
                "latitude": 30.598,
                "longitude": 103.991,
                "relative_altitude": 50.0,
                "speed_m_s": 10.0,
            }
        ],
    }
    response = client.post("/api/v1/missions/upload", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "mission_id" in body
    assert "execution_id" in body
    assert body["mission_status"] in {"EXECUTING", "UPLOADED"}
    assert body["execution_status"] in {"RUNNING", "QUEUED"}


def test_mission_detail_and_execution_detail():
    payload = {
        "name": "Mission Detail Test",
        "waypoints": [
            {
                "latitude": 30.598,
                "longitude": 103.991,
                "relative_altitude": 50.0,
                "speed_m_s": 10.0,
            }
        ],
    }
    upload_response = client.post("/api/v1/missions/upload", json=payload)
    upload_body = upload_response.json()

    mission_response = client.get(f"/api/v1/missions/{upload_body['mission_id']}")
    assert mission_response.status_code == 200
    mission_body = mission_response.json()
    assert mission_body["id"] == upload_body["mission_id"]
    assert len(mission_body["executions"]) >= 1

    execution_response = client.get(
        f"/api/v1/missions/executions/{upload_body['execution_id']}"
    )
    assert execution_response.status_code == 200
    execution_body = execution_response.json()
    assert execution_body["mission_id"] == upload_body["mission_id"]
    assert execution_body["execution_id"] == upload_body["execution_id"]
    assert isinstance(execution_body["trace"], list)


def test_execution_pause_resume_cancel_flow():
    payload = {
        "name": "Mission Control Flow",
        "waypoints": [
            {
                "latitude": 30.598,
                "longitude": 103.991,
                "relative_altitude": 50.0,
                "speed_m_s": 10.0,
            },
            {
                "latitude": 30.599,
                "longitude": 103.992,
                "relative_altitude": 50.0,
                "speed_m_s": 10.0,
            },
        ],
    }
    upload_response = client.post("/api/v1/missions/upload", json=payload)
    execution_id = upload_response.json()["execution_id"]

    pause_response = client.post(f"/api/v1/missions/executions/{execution_id}/pause")
    assert pause_response.status_code == 200
    assert pause_response.json()["execution_status"] == "PAUSED"

    resume_response = client.post(f"/api/v1/missions/executions/{execution_id}/resume")
    assert resume_response.status_code == 200
    assert resume_response.json()["execution_status"] == "RUNNING"

    cancel_response = client.post(f"/api/v1/missions/executions/{execution_id}/cancel")
    assert cancel_response.status_code == 200
    assert cancel_response.json()["execution_status"] == "CANCELLED"
