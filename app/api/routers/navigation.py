from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.drone_state import drone_state
from app.infrastructure.navigation.path_planner import path_planner

router = APIRouter()


class PlanRequest(BaseModel):
    target_latitude: float
    target_longitude: float
    start_latitude: float | None = None
    start_longitude: float | None = None


@router.post("/plan")
async def plan_navigation(request: PlanRequest):
    start_lat = request.start_latitude if request.start_latitude is not None else drone_state.lat
    start_lon = request.start_longitude if request.start_longitude is not None else drone_state.lon

    try:
        plan = await path_planner.plan_path(
            start_lat,
            start_lon,
            request.target_latitude,
            request.target_longitude,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Navigation planning failed: {exc}") from exc

    if not plan["waypoints"]:
        raise HTTPException(status_code=422, detail="No route could be generated")

    return {
        "status": "success",
        "route_type": plan["route_type"],
        "fallback_used": plan["fallback_used"],
        "start": {"latitude": start_lat, "longitude": start_lon},
        "target": {
            "latitude": request.target_latitude,
            "longitude": request.target_longitude,
        },
        "waypoints": plan["waypoints"],
    }
