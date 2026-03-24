from app.domain.mission import MissionStatus
from app.domain.mission_execution import ExecutionStatus


class MissionStateMachine:
    mission_transitions = {
        MissionStatus.DRAFT: {
            MissionStatus.PLANNED,
            MissionStatus.UPLOADED,
            MissionStatus.EXECUTING,
            MissionStatus.FAILED,
            MissionStatus.CANCELLED,
        },
        MissionStatus.PLANNED: {
            MissionStatus.UPLOADED,
            MissionStatus.EXECUTING,
            MissionStatus.CANCELLED,
        },
        MissionStatus.UPLOADED: {
            MissionStatus.EXECUTING,
            MissionStatus.PAUSED,
            MissionStatus.COMPLETED,
            MissionStatus.FAILED,
            MissionStatus.CANCELLED,
        },
        MissionStatus.EXECUTING: {
            MissionStatus.PAUSED,
            MissionStatus.COMPLETED,
            MissionStatus.FAILED,
            MissionStatus.CANCELLED,
        },
        MissionStatus.PAUSED: {
            MissionStatus.EXECUTING,
            MissionStatus.CANCELLED,
            MissionStatus.FAILED,
            MissionStatus.COMPLETED,
        },
        MissionStatus.COMPLETED: set(),
        MissionStatus.FAILED: set(),
        MissionStatus.CANCELLED: set(),
    }

    execution_transitions = {
        ExecutionStatus.QUEUED: {
            ExecutionStatus.RUNNING,
            ExecutionStatus.PAUSED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
        },
        ExecutionStatus.RUNNING: {
            ExecutionStatus.PAUSED,
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.CANCELLED,
        },
        ExecutionStatus.PAUSED: {
            ExecutionStatus.RUNNING,
            ExecutionStatus.CANCELLED,
            ExecutionStatus.FAILED,
            ExecutionStatus.COMPLETED,
        },
        ExecutionStatus.COMPLETED: set(),
        ExecutionStatus.FAILED: set(),
        ExecutionStatus.CANCELLED: set(),
    }

    def transition_mission(self, current: MissionStatus, target: MissionStatus) -> MissionStatus:
        if target == current:
            return target
        if target not in self.mission_transitions[current]:
            raise ValueError(f"Invalid mission transition: {current} -> {target}")
        return target

    def transition_execution(
        self,
        current: ExecutionStatus,
        target: ExecutionStatus,
    ) -> ExecutionStatus:
        if target == current:
            return target
        if target not in self.execution_transitions[current]:
            raise ValueError(f"Invalid execution transition: {current} -> {target}")
        return target


mission_state_machine = MissionStateMachine()
