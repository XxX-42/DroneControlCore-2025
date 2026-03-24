from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID


class ExecutionStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class MissionExecution:
    id: UUID
    mission_id: UUID
    mode: str
    status: ExecutionStatus
    started_at: datetime
    ended_at: datetime | None = None
    error_message: str | None = None
