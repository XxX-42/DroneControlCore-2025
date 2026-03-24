import logging

from app.core.drone_state import drone_state
from app.domain.mission import Mission

logger = logging.getLogger(__name__)


class SimulationExecutor:
    async def execute(self, mission: Mission):
        sim_route = []
        last_index = len(mission.waypoints) - 1
        for index, wp in enumerate(mission.waypoints):
            sim_route.append(
                {
                    "latitude": wp.latitude,
                    "longitude": wp.longitude,
                    "is_user_target": index == last_index,
                }
            )

        drone_state.set_mission(sim_route)
        logger.info("Simulation mission queued with %s waypoints", len(sim_route))


simulation_executor = SimulationExecutor()
