from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_port: int = 8000
    redis_url: str = "redis://redis:6379/0"
    data_dir: str = "/data"
    token: str = "devtoken"
    otel_exporter_otlp_endpoint: str | None = None
    otel_service_name: str = "meatyprojects-api"
    seed_demo: int = 1

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

