import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    """Call GET / and assert status 200."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "System Online"}

@pytest.mark.asyncio
async def test_history_endpoint():
    """Call GET /api/v1/missions/history and assert status 200."""
    # Note: TestClient handles async endpoints automatically for standard requests,
    # but since we are using async DB, we might need to ensure the event loop is handled.
    # However, TestClient with FastAPI usually works fine for simple checks.
    response = client.get("/api/v1/missions/history")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
