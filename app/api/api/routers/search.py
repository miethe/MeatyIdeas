from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text

from ..db import engine


router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str, project_id: str | None = None, tag: str | None = None) -> list[dict[str, Any]]:
    # MVP: only full-text search, filters applied after join in more advanced impl
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT file_id FROM search_index WHERE search_index MATCH :q LIMIT 50"),
            {"q": q},
        ).fetchall()
    return [{"file_id": r[0]} for r in rows]

