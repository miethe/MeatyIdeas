from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .settings import settings


class Base(DeclarativeBase):
    pass


db_path = os.path.join(settings.data_dir, "app.sqlite3")
os.makedirs(settings.data_dir, exist_ok=True)
engine = create_engine(f"sqlite:///{db_path}", future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def init_db() -> None:
    # Create FTS table if not exists
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                    file_id UNINDEXED,
                    content_text
                );
                """
            )
        )
        conn.commit()

    # Lightweight migration for bundles table new columns (SQLite only)
    try:
        with engine.connect() as conn:
            # Inspect existing columns
            cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info('bundles')").fetchall()]
            alters: list[str] = []
            if cols:
                if "status" not in cols:
                    alters.append("ALTER TABLE bundles ADD COLUMN status VARCHAR DEFAULT 'completed'")
                if "error" not in cols:
                    alters.append("ALTER TABLE bundles ADD COLUMN error TEXT DEFAULT ''")
                if "bundle_metadata" not in cols:
                    alters.append("ALTER TABLE bundles ADD COLUMN bundle_metadata JSON")
                if "branch" not in cols:
                    alters.append("ALTER TABLE bundles ADD COLUMN branch VARCHAR NULL")
                if "pr_url" not in cols:
                    alters.append("ALTER TABLE bundles ADD COLUMN pr_url VARCHAR NULL")
                for stmt in alters:
                    conn.exec_driver_sql(stmt)
                if alters:
                    conn.commit()
    except Exception:
        # Best-effort; in fresh DB create_all will suffice
        pass


@contextmanager
def session_scope() -> Generator:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
