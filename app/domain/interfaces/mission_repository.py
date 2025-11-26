from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from app.domain.mission import Mission

class IMissionRepository(ABC):
    @abstractmethod
    async def save(self, mission: Mission) -> Mission:
        pass

    @abstractmethod
    async def get_by_id(self, mission_id: UUID) -> Optional[Mission]:
        pass

    @abstractmethod
    async def get_all(self) -> List[Mission]:
        pass
