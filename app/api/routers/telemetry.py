from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Body
from app.core.drone_state import drone_state
import asyncio
import json

router = APIRouter()

# --- HTTP 控制接口 ---

@router.get("/status")
async def telemetry_status():
    return {"status": "Active"}

@router.post("/speed")
async def update_speed(speed: float = Body(..., embed=True)):
    # 简单的速度设置 (1x - 100x)
    drone_state.set_speed(speed)
    return {"message": f"Speed set to {drone_state.speed}"}

@router.post("/spiral-speed")
async def set_spiral_speed(speed: float = Body(..., embed=True)):
    # 设置螺旋角速度
    drone_state.set_spiral_speed(speed)
    return {"msg": "ok"}

# --- WebSocket 实时流 ---

@router.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    print(">>> [后端] 收到前端 WebSocket 连接请求...")
    await websocket.accept()
    print(">>> [后端] 连接建立，开始推送遥测数据。")
    
    try:
        while True:
            # 1. 计算下一帧位置 (物理引擎步进)
            drone_state.update_position()
            
            # 2. 打包数据
            payload = {
                "lat": drone_state.lat,
                "lon": drone_state.lon,
                "alt": drone_state.alt,
                "heading": drone_state.heading
            }
            
            # 3. 发送
            await websocket.send_json(payload)
            
            # 4. 频率控制 (20Hz)
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        print(">>> [后端] 前端断开了连接")
    except Exception as e:
        print(f"!!! [后端] WebSocket 发生错误: {e}")