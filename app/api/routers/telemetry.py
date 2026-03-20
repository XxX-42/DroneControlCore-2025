import asyncio

from fastapi import APIRouter, Body, WebSocket, WebSocketDisconnect

from app.core.drone_state import drone_state

router = APIRouter()


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
    print(">>> [backend] WebSocket connection requested")
    await websocket.accept()
    print(">>> [backend] WebSocket connected, streaming telemetry")

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
                print(f"WebSocket runtime error: {exc}")
                break

            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        print(">>> [backend] WebSocket disconnected")
    except Exception as exc:
        print(f"!!! [backend] WebSocket error: {exc}")
