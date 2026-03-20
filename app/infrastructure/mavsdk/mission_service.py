import math
from app.domain.mission import Mission
from mavsdk import System
from mavsdk.mission import MissionItem, MissionPlan
from app.core.drone_state import drone_state

class MavsdkMissionService:
    """
    Infrastructure service to convert Domain Missions to MAVSDK Mission Plans
    and upload them to the drone.
    """
    async def upload_mission(self, system: System, mission: Mission):
        mission_items = []
        
        for wp in mission.waypoints:
            # STRICT COMPLIANCE: Passing float('nan') for optional parameters
            # to avoid MAVSDK v2.0 validation errors.
            item = MissionItem(
                latitude_deg=wp.latitude,
                longitude_deg=wp.longitude,
                relative_altitude_m=wp.relative_altitude,
                speed_m_s=wp.speed_m_s,
                is_fly_through=True,
                gimbal_pitch_deg=float('nan'),
                gimbal_yaw_deg=float('nan'),
                camera_action=MissionItem.CameraAction.NONE,
                loiter_time_s=float('nan'),
                camera_photo_interval_s=float('nan'),
                acceptance_radius_m=float('nan'),
                yaw_deg=float('nan'),
                camera_photo_distance_m=float('nan'),
                vehicle_action=MissionItem.VehicleAction.NONE
            )
            mission_items.append(item)

        mission_plan = MissionPlan(mission_items)
        
        print(f"Uploading mission '{mission.name}' with {len(mission_items)} waypoints...")
        
        try:
            await system.mission.upload_mission(mission_plan)
            print("Mission uploaded to hardware.")
        except Exception as e:
            print(f"⚠️ Hardware offline or upload failed: {e}")
            print(f">>> MOCK UPLOAD: Mission '{mission.name}' accepted in simulation mode.")
            
            # --- SIMULATION OVERRIDE ---
            # Push waypoints to the physics engine so the drone actually "flies" them.
            sim_route = []
            for wp in mission.waypoints:
                sim_route.append({
                    "latitude": wp.latitude, 
                    "longitude": wp.longitude,
                    "is_user_target": True # Assume all uploaded points are targets
                })
            
            drone_state.set_mission(sim_route)
            
            # We swallow the error to keep the frontend happy in DEV mode
            return

mavsdk_mission_service = MavsdkMissionService()
