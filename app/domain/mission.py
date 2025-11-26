from dataclasses import dataclass
from datetime import datetime
from typing import List
from uuid import UUID

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
    status: str  # "DRAFT", "EXECUTING", "COMPLETED"
