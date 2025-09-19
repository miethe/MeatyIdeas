from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.api.db import engine


def run_upgrade_head() -> None:
    cfg_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_cfg = Config(str(cfg_path))
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    command.upgrade(alembic_cfg, "head")


__all__ = ["run_upgrade_head"]
