from mavsdk import System
from mavsdk.mission import MissionItem, MissionPlan

from app.domain.mission import Mission


class MavsdkMissionService:
    """
    Infrastructure service to convert Domain Missions to MAVSDK Mission Plans
    and upload them to the drone.
    """

    def build_mission_plan(self, mission: Mission) -> MissionPlan:
        mission_items = []

        for wp in mission.waypoints:
            item = MissionItem(
                latitude_deg=wp.latitude,
                longitude_deg=wp.longitude,
                relative_altitude_m=wp.relative_altitude,
                speed_m_s=wp.speed_m_s,
                is_fly_through=True,
                gimbal_pitch_deg=float("nan"),
                gimbal_yaw_deg=float("nan"),
                camera_action=MissionItem.CameraAction.NONE,
                loiter_time_s=float("nan"),
                camera_photo_interval_s=float("nan"),
                acceptance_radius_m=float("nan"),
                yaw_deg=float("nan"),
                camera_photo_distance_m=float("nan"),
                vehicle_action=MissionItem.VehicleAction.NONE,
            )
            mission_items.append(item)

        return MissionPlan(mission_items)

    async def upload_mission(self, system: System, mission: Mission):
        mission_plan = self.build_mission_plan(mission)
        print(f"Uploading mission '{mission.name}' with {len(mission.waypoints)} waypoints...")
        await system.mission.upload_mission(mission_plan)
        print("Mission uploaded to hardware.")


mavsdk_mission_service = MavsdkMissionService()
