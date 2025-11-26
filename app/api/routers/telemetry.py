from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import math
import time

router = APIRouter()

# 这是一个测试用的 HTTP 接口
@router.get("/status")
async def telemetry_status():
    return {"status": "Active"}

# 这是一个 WebSocket 接口
@router.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    print(">>> [后端] 收到前端的连接请求...")
    await websocket.accept()
    print(">>> [后端] 连接已建立，开始发送数据！")
    
    try:
        start_time = time.time()
        # 初始坐标 (成都)
        center_lat = 30.598
        center_lon = 103.991
        
        while True:
            # 简单的圆形飞行逻辑
            t = time.time() - start_time
            offset_lat = 0.005 * math.sin(t)
            offset_lon = 0.005 * math.cos(t)
            
            payload = {
                "lat": center_lat + offset_lat,
                "lon": center_lon + offset_lon,
                "alt": 100 + 10 * math.sin(t * 0.5),
                "heading": (t * 20) % 360
            }
            
            # 发送数据
            await websocket.send_json(payload)
            # 打印日志证明在工作 (只在终端显示)
            # print(f"发送数据: {payload}") 
            
            # 控制发送频率 (20Hz)
            await asyncio.sleep(0.05)
            
    except WebSocketDisconnect:
        print(">>> [后端] 前端断开了连接")
    except Exception as e:
        print(f"!!! [后端] 发生错误: {e}")