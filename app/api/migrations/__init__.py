from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from ..db import engine


def run_upgrade_head() -> None:
    cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    alembic_cfg = Config(str(cfg_path))
    alembic_cfg.set_main_option("sqlalchemy.url", str(engine.url))
    # Set script_location to the actual path of this migrations folder, relative to the project root
    migrations_path = Path(__file__).resolve().parent
    alembic_cfg.set_main_option("script_location", str(migrations_path))
    command.upgrade(alembic_cfg, "head")


__all__ = ["run_upgrade_head"]
