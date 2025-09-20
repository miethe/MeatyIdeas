from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import text

from ..db import SessionLocal, engine
from ..services.tagging import get_tag_usage


router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("/tags")
def filter_tags(q: str | None = None, limit: int = Query(default=100, ge=1, le=500)) -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        return get_tag_usage(db, limit=limit, q=q)
    finally:
        db.close()


@router.get("/languages")
def filter_languages(limit: int = Query(default=100, ge=1, le=500)) -> list[dict[str, Any]]:
    sql = text(
        "SELECT lower(language) as language, COUNT(1) as count FROM search_index WHERE language IS NOT NULL AND language != '' GROUP BY lower(language) ORDER BY count DESC LIMIT :limit"
    )
    with engine.connect() as conn:
        rows = conn.execute(sql, {"limit": limit}).all()
    return [
        {
            "label": row[0],
            "slug": row[0],
            "count": int(row[1]),
        }
        for row in rows
    ]
