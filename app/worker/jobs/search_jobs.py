from __future__ import annotations

from sqlalchemy import text

from api.db import engine
from api.models import File, Project
from api.search import index_file
from api.settings import settings
from sqlalchemy.orm import Session
from api.db import SessionLocal


def reindex_all() -> dict[str, str]:
    # Drop and recreate multi-column FTS5 table, then reindex all files
    with engine.begin() as conn:
        # Create new FTS schema
        conn.exec_driver_sql("DROP TABLE IF EXISTS search_index;")
        conn.exec_driver_sql(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                file_id UNINDEXED,
                project_id UNINDEXED,
                project_slug UNINDEXED,
                project_name UNINDEXED,
                title,
                body,
                path,
                tags,
                language,
                updated_at UNINDEXED,
                is_archived UNINDEXED,
                project_status UNINDEXED
            );
            """
        )
    # Walk all files
    db: Session = SessionLocal()
    try:
        for f in db.query(File).all():
            proj = db.get(Project, f.project_id)
            rel_path = f.path
            with engine.begin() as conn:
                index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    finally:
        db.close()
    return {"status": "ok"}
