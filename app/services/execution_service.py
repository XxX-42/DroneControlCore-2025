import logging
from datetime import datetime
import json

from fastapi import HTTPException

from app.core.drone_state import drone_state
from app.core.settings import AppMode, settings
from app.domain.mission import Mission, MissionStatus
from app.domain.mission_execution import ExecutionStatus
from app.infrastructure.database.models import MissionExecutionModel, MissionModel
from app.services.hardware_executor import hardware_executor
from app.services.mission_state_machine import mission_state_machine
from app.services.simulation_executor import simulation_executor

logger = logging.getLogger(__name__)


class ExecutionService:
    def __init__(self):
        self.active_simulation_execution_id: str | None = None
        self.active_simulation_mission_id: str | None = None

    async def execute_mission(self, mission: Mission) -> dict:
        logger.info("Executing mission '%s' in %s mode", mission.name, settings.app_mode.value)
        if settings.app_mode == AppMode.SIMULATION:
            await simulation_executor.execute(mission)
            self.active_simulation_execution_id = None
            self.active_simulation_mission_id = str(mission.id)
            return {
                "mode": settings.app_mode.value,
                "mission_status": mission_state_machine.transition_mission(
                    mission.status,
                    MissionStatus.EXECUTING,
                ).value,
                "execution_status": ExecutionStatus.RUNNING.value,
            }

        await hardware_executor.execute(mission)
        return {
            "mode": settings.app_mode.value,
            "mission_status": mission_state_machine.transition_mission(
                mission.status,
                MissionStatus.UPLOADED,
            ).value,
            "execution_status": ExecutionStatus.QUEUED.value,
        }

    def bind_simulation_execution(self, mission_id: str, execution_id: str):
        self.active_simulation_mission_id = mission_id
        self.active_simulation_execution_id = execution_id

    def sync_trace_to_execution(self, execution: MissionExecutionModel) -> bool:
        if execution.mode != AppMode.SIMULATION.value:
            return False
        trace_json = json.dumps(drone_state.get_trace_snapshot())
        if execution.trace_json == trace_json:
            return False
        execution.trace_json = trace_json
        return True

    async def reconcile_simulation_state(self, mission: MissionModel, execution: MissionExecutionModel) -> bool:
        if execution.mode != AppMode.SIMULATION.value:
            return False
        changed = self.sync_trace_to_execution(execution)
        if execution.status not in {ExecutionStatus.RUNNING.value, ExecutionStatus.PAUSED.value}:
            return changed
        if mission.mission_uuid != self.active_simulation_mission_id:
            return changed
        if drone_state.is_paused and execution.status != ExecutionStatus.PAUSED.value:
            execution.status = ExecutionStatus.PAUSED.value
            mission.status = MissionStatus.PAUSED.value
            return True
        if not drone_state.is_paused and execution.status == ExecutionStatus.PAUSED.value:
            execution.status = ExecutionStatus.RUNNING.value
            mission.status = MissionStatus.EXECUTING.value
            return True
        if drone_state.state == "IDLE" and not drone_state.waypoint_queue:
            execution.status = ExecutionStatus.COMPLETED.value
            execution.ended_at = datetime.now()
            mission.status = MissionStatus.COMPLETED.value
            if execution.execution_uuid == self.active_simulation_execution_id:
                self.active_simulation_execution_id = None
                self.active_simulation_mission_id = None
            return True
        return changed

    async def pause_execution(self, mission: MissionModel, execution: MissionExecutionModel):
        if execution.mode != AppMode.SIMULATION.value:
            raise HTTPException(status_code=409, detail="Pause is only implemented for simulation mode")
        execution.status = mission_state_machine.transition_execution(
            ExecutionStatus(execution.status),
            ExecutionStatus.PAUSED,
        ).value
        mission.status = mission_state_machine.transition_mission(
            MissionStatus(mission.status),
            MissionStatus.PAUSED,
        ).value
        drone_state.pause_mission()
        self.sync_trace_to_execution(execution)
        return execution.status, mission.status

    async def resume_execution(self, mission: MissionModel, execution: MissionExecutionModel):
        if execution.mode != AppMode.SIMULATION.value:
            raise HTTPException(status_code=409, detail="Resume is only implemented for simulation mode")
        execution.status = mission_state_machine.transition_execution(
            ExecutionStatus(execution.status),
            ExecutionStatus.RUNNING,
        ).value
        mission.status = mission_state_machine.transition_mission(
            MissionStatus(mission.status),
            MissionStatus.EXECUTING,
        ).value
        drone_state.resume_mission()
        self.sync_trace_to_execution(execution)
        return execution.status, mission.status

    async def cancel_execution(self, mission: MissionModel, execution: MissionExecutionModel):
        execution.status = mission_state_machine.transition_execution(
            ExecutionStatus(execution.status),
            ExecutionStatus.CANCELLED,
        ).value
        mission.status = mission_state_machine.transition_mission(
            MissionStatus(mission.status),
            MissionStatus.CANCELLED,
        ).value
        execution.ended_at = datetime.now()
        if execution.mode == AppMode.SIMULATION.value:
            drone_state.cancel_mission()
            self.sync_trace_to_execution(execution)
        if execution.execution_uuid == self.active_simulation_execution_id:
            self.active_simulation_execution_id = None
            self.active_simulation_mission_id = None
        return execution.status, mission.status


execution_service = ExecutionService()
