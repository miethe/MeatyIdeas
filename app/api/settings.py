from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_port: int = 8000
    redis_url: str = "redis://redis:6379/0"
    data_dir: str = "/data"
    token: str = "devtoken"
    web_port: int | None = None
    otel_exporter_otlp_endpoint: str | None = None
    otel_service_name: str = "meatyprojects-api"
    seed_demo: int = 1
    github_token: str | None = None
    semantic_search: int = 0
    search_max_limit: int = 50
    # Feature flags
    git_integration: int = 0
    share_links: int = 0
    groups_ui: int = 0
    dirs_persist: int = 0
    results_modal: int = 1

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
