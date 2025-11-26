from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.infrastructure.database.db import Base

class MissionModel(Base):
    __tablename__ = "missions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="UPLOADED")
    waypoints_json = Column(Text) # Storing JSON string of waypoints
