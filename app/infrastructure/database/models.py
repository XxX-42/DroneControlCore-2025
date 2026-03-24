from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.infrastructure.database.db import Base


class MissionModel(Base):
    __tablename__ = "missions"

    id = Column(Integer, primary_key=True, index=True)
    mission_uuid = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="UPLOADED")
    waypoints_json = Column(Text)


class MissionExecutionModel(Base):
    __tablename__ = "mission_executions"

    id = Column(Integer, primary_key=True, index=True)
    execution_uuid = Column(String, unique=True, index=True)
    mission_uuid = Column(String, index=True)
    mode = Column(String, index=True)
    status = Column(String, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
