from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_port: int = 8000
    redis_url: str = "redis://redis:6379/0"
    data_dir: str = "data"  # Use relative path for local/dev and Docker.
    # To override for local development, set DATA_DIR in your .env file or environment variables.
    # Example: DATA_DIR=../data
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
    search_v2: int = 1
    search_modal_v2: int = 1
    search_filters_v2: int = 1
    tags_v2: int = 1
    project_modal: int = 0
    project_statuses: str | None = None
    file_types: str | None = None
    project_templates: str | None = None
    config_version: str = "2025-09-27-set2"
    ux_creation_dashboard_refresh: int = 0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
