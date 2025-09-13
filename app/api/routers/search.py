from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from ..db import engine, SessionLocal
from ..models import SavedSearch
from ..schemas import SavedSearchCreate, SavedSearchRead
from ..settings import settings


router = APIRouter(prefix="/search", tags=["search"])


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _fts_columns(conn: Connection) -> list[str]:
    rows = conn.exec_driver_sql("PRAGMA table_info('search_index')").fetchall()
    return [r[1] for r in rows]


@router.get("")
def search(
    q: str,
    project_id: str | None = None,
    tag: list[str] | None = None,
    status: str | None = None,
    sort: str = "score",
    limit: int = 20,
    offset: int = 0,
    facets: int = 0,
) -> Any:
    # FTS5 with snippet and basic filters. Join files/projects for metadata.
    limit = max(1, min(limit, settings.search_max_limit))
    if sort not in ("score", "updated_at"):
        raise HTTPException(status_code=400, detail={"code": "BAD_SORT", "message": "Invalid sort"})

    sql_tmpl = (
        """
        SELECT f.id as file_id,
               f.title as title,
               f.path as path,
               p.id as project_id,
               snippet(search_index, {snippet_col}, '[', ']', '...', 8) as snippet,
               bm25(search_index) as score
        FROM search_index
        JOIN files f ON f.id = search_index.file_id
        JOIN projects p ON p.id = f.project_id
        WHERE search_index MATCH :q
        {and_project}
        {and_status}
        {and_tag}
        {order_by}
        LIMIT :limit OFFSET :offset
        """
    )
    and_project = ""
    and_status = ""
    and_tag = ""
    params: dict[str, Any] = {"q": q, "limit": limit, "offset": offset}
    if project_id:
        and_project = " AND p.id = :project_id"
        params["project_id"] = project_id
    if status:
        and_status = " AND p.status = :status"
        params["status"] = status
    if tag:
        # Prefer JSON1 exact match; allow multiple tags (AND semantics across values)
        clauses = []
        for i, t in enumerate(tag):
            key = f"tag{i}"
            params[key] = t
            clauses.append(
                " EXISTS (SELECT 1 FROM json_each(f.tags) je WHERE je.value = :" + key + ") "
            )
        and_tag = " AND " + " AND ".join(clauses)

    order_by = " ORDER BY score ASC, f.updated_at DESC " if sort == "score" else " ORDER BY f.updated_at DESC "

    with engine.begin() as conn:
        cols = _fts_columns(conn)
        # choose snippet column: prefer body, fallback to content_text
        snippet_col = 2 if ("body" in cols and "title" in cols) else 1
        sql = sql_tmpl.format(
            and_project=and_project,
            and_status=and_status,
            and_tag=and_tag,
            order_by=order_by,
            snippet_col=snippet_col,
        )
        rows = conn.execute(text(sql), params).mappings().all()

        facets_out: dict[str, Any] | None = None
        if int(facets or 0) == 1:
            # Facets: limited to current q + (project/status) filters; count tags/status across matching files (no limit/offset)
            facets_out = {"tags": [], "status": []}
            facet_base = (
                "SELECT f.id as fid, p.status as status FROM search_index si "
                "JOIN files f ON f.id = si.file_id JOIN projects p ON p.id = f.project_id "
                "WHERE si MATCH :q {and_project} {and_status} {and_tag}"
            ).format(and_project=and_project, and_status=and_status, and_tag=and_tag)
            # Status facet
            st_rows = conn.execute(text(f"SELECT status, COUNT(1) as c FROM ({facet_base}) GROUP BY status"), params).all()
            facets_out["status"] = [{"name": r[0], "count": r[1]} for r in st_rows]
            # Tags facet
            tag_rows = conn.execute(
                text(
                    "SELECT je.value as tag, COUNT(1) as c FROM (" + facet_base + ") x, json_each((SELECT tags FROM files WHERE id = x.fid)) je GROUP BY je.value"
                ),
                params,
            ).all()
            facets_out["tags"] = [{"name": r[0], "count": r[1]} for r in tag_rows]

    out = [dict(r) for r in rows]
    if int(facets or 0) == 1:
        return {"results": out, "facets": facets_out}
    return out


@router.get("/saved", response_model=list[SavedSearchRead])
def list_saved_searches(db: Session = Depends(_get_db)):
    rows = db.query(SavedSearch).order_by(SavedSearch.created_at.desc()).all()
    return rows


@router.post("/saved", response_model=SavedSearchRead, status_code=201)
def create_saved_search(body: SavedSearchCreate, db: Session = Depends(_get_db)):
    s = SavedSearch(name=body.name, owner="default", query=body.query or "", filters=body.filters or {})
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/saved/{sid}", status_code=204)
def delete_saved_search(sid: str, db: Session = Depends(_get_db)):
    s = db.get(SavedSearch, sid)
    if not s:
        return
    db.delete(s)
    db.commit()
    return


@router.post("/index/rebuild")
def rebuild_index() -> dict[str, Any]:
    # Enqueue background reindex job
    import redis as _redis
    import rq as _rq
    from ..settings import settings as _settings

    q = _rq.Queue("default", connection=_redis.from_url(_settings.redis_url))
    job = q.enqueue("worker.jobs.search_jobs.reindex_all", job_timeout=600)
    return {"job_id": job.id}
