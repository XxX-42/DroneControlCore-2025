import asyncio
import logging

from fastapi import APIRouter, Body, WebSocket, WebSocketDisconnect

from app.core.drone_state import drone_state
from app.core.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status")
async def telemetry_status():
    return {"status": "Active"}


@router.post("/speed")
async def update_speed(speed: float = Body(..., embed=True)):
    drone_state.set_speed(speed)
    return {"message": f"Speed set to {drone_state.sim_speed_factor}"}


@router.post("/spiral-speed")
async def set_spiral_speed(speed: float = Body(..., embed=True)):
    drone_state.set_spiral_speed(speed)
    return {"msg": "ok"}


@router.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("WebSocket connection requested")
    await websocket.accept()
    logger.info("WebSocket connected, streaming telemetry")

    try:
        while True:
            try:
                await websocket.send_json(
                    {
                        "lat": drone_state.lat,
                        "lon": drone_state.lon,
                        "alt": drone_state.alt,
                        "heading": drone_state.heading,
                        "pitch": drone_state.pitch,
                        "roll": drone_state.roll,
                        "yaw": drone_state.yaw,
                    }
                )
            except RuntimeError as exc:
                logger.warning("WebSocket runtime error: %s", exc)
                break

            await asyncio.sleep(settings.telemetry_interval_ms / 1000)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.exception("WebSocket error: %s", exc)
