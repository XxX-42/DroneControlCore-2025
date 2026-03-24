import logging

from mavsdk import System

from app.core.settings import settings


logger = logging.getLogger(__name__)


class MavsdkConnectionManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MavsdkConnectionManager, cls).__new__(cls)
            cls._instance.system = None
        return cls._instance

    async def connect(self, system_address: str | None = None):
        address = system_address or settings.mavsdk_system_address
        self.system = System()
        await self.system.connect(system_address=address)
        logger.info("Waiting for drone to connect on %s", address)
        # In a real app, we might wait for state, but for init we just start
        # async for state in self.system.core.connection_state():
        #     if state.is_connected:
        #         print("Drone connected!")
        #         break

mavsdk_manager = MavsdkConnectionManager()
