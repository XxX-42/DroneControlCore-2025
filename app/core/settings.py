from enum import Enum

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppMode(str, Enum):
    SIMULATION = "simulation"
    SITL = "sitl"
    HARDWARE = "hardware"


class Settings(BaseSettings):
    app_mode: AppMode = AppMode.SIMULATION
    api_host: str = "127.0.0.1"
    api_port: int = 8080
    db_url: str = "sqlite+aiosqlite:///./drone.db"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:5173", "http://127.0.0.1:5174"]
    )
    osm_center_lat: float = 30.598
    osm_center_lon: float = 103.991
    osm_radius_m: int = 5000
    telemetry_interval_ms: int = 50
    sim_default_altitude_m: float = 100.0
    mavsdk_system_address: str = "udp://:14540"
    sql_echo: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
