from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine


router = APIRouter(prefix="/tags", tags=["tags"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_tags(q: str | None = None, project_id: str | None = None) -> list[dict[str, Any]]:
    # Derive distinct tags from files.tags JSON
    try:
        with engine.connect() as conn:
            # Prefer JSON1-enabled query
            conn.exec_driver_sql("select json('null')")
            has_json1 = True
    except Exception:
        has_json1 = False

    params: dict[str, Any] = {}
    if has_json1:
        sql = (
            "SELECT je.value as tag, COUNT(1) as c FROM files f, json_each(f.tags) je"
        )
        where = []
        if project_id:
            where.append(" f.project_id = :project_id ")
            params["project_id"] = project_id
        if q:
            where.append(" je.value LIKE :q ")
            params["q"] = f"{q}%"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " GROUP BY je.value ORDER BY c DESC, tag ASC LIMIT 200"
        with engine.connect() as conn:
            rows = conn.exec_driver_sql(sql, params).all()
        return [{"name": r[0], "count": r[1]} for r in rows]
    # Fallback without JSON1: scan tags by LIKE, approximate distinct
    where = []
    if project_id:
        where.append(" project_id = :project_id ")
        params["project_id"] = project_id
    sql = "SELECT tags FROM files"
    if where:
        sql += " WHERE " + " AND ".join(where)
    tags: dict[str, int] = {}
    with engine.connect() as conn:
        for (tags_json,) in conn.exec_driver_sql(sql, params).all():
            try:
                import json as _json

                arr = _json.loads(tags_json or "[]")
                for t in arr:
                    if q and not str(t).startswith(q):
                        continue
                    tags[t] = tags.get(t, 0) + 1
            except Exception:
                continue
    out = sorted(tags.items(), key=lambda x: (-x[1], str(x[0]).lower()))[:200]
    return [{"name": k, "count": v} for k, v in out]

