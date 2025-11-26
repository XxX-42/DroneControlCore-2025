from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from app.core.drone_state import drone_state
from pydantic import BaseModel

class SpeedRequest(BaseModel):
    speed: float

router = APIRouter()

@router.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Update Physics
            drone_state.update_position()
            
            data = {
                "lat": drone_state.lat,
                "lon": drone_state.lon,
                "heading": drone_state.heading,
                "alt": drone_state.alt
            }
            
            await websocket.send_json(data)
            await asyncio.sleep(0.05) # 20Hz update rate
            
    except WebSocketDisconnect:
        print("Telemetry client disconnected")

@router.post("/api/v1/telemetry/speed")
async def update_speed(request: SpeedRequest):
    drone_state.set_speed(request.speed)
    return {"message": f"Speed set to {drone_state.speed}"}