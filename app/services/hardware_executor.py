import logging

from fastapi import HTTPException

from app.domain.mission import Mission
from app.infrastructure.mavsdk.connection import mavsdk_manager
from app.infrastructure.mavsdk.mission_service import mavsdk_mission_service

logger = logging.getLogger(__name__)


class HardwareExecutor:
    async def execute(self, mission: Mission):
        if not mavsdk_manager.system:
            raise HTTPException(status_code=503, detail="Drone not connected")

        logger.info("Uploading mission '%s' to MAVSDK target", mission.name)
        await mavsdk_mission_service.upload_mission(mavsdk_manager.system, mission)


hardware_executor = HardwareExecutor()
