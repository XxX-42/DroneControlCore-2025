from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List
from uuid import UUID


class MissionStatus(str, Enum):
    DRAFT = "DRAFT"
    PLANNED = "PLANNED"
    UPLOADED = "UPLOADED"
    EXECUTING = "EXECUTING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class Waypoint:
    latitude: float
    longitude: float
    relative_altitude: float
    speed_m_s: float


@dataclass
class Mission:
    id: UUID
    name: str
    waypoints: List[Waypoint]
    created_at: datetime
    status: MissionStatus
