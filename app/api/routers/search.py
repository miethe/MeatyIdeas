from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..app_logging import get_logger
from ..db import SessionLocal, engine
from ..models import SavedSearch
from ..schemas import SavedSearchCreate, SavedSearchRead
from ..search import SearchQuery, get_search_service
from ..services.tagging import get_tag_usage
from ..settings import settings


router = APIRouter(prefix="/search", tags=["search"])
log = get_logger(component="search")


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    text = str(value).strip().lower()
    if text in {"1", "true", "yes"}:
        return True
    if text in {"0", "false", "no"}:
        return False
    return None


@router.get("")
def search(  # noqa: PLR0913 — endpoint parameters
    q: str = "",
    scope: str = Query(default="all"),
    tags: list[str] = Query(default_factory=list, alias="tags[]"),
    language: str | None = None,
    updated_after: str | None = None,
    updated_before: str | None = None,
    owner: str | None = None,
    has_readme: bool | None = Query(default=None),
    project_id: str | None = None,
    project_slug: str | None = None,
    limit: int = 20,
    cursor: str | None = None,
    facets: int = 0,
) -> dict[str, Any]:
    scope_normalized = scope.lower()
    if scope_normalized not in {"all", "files", "projects"}:
        raise HTTPException(status_code=400, detail={"code": "BAD_SCOPE", "message": "Scope must be all|files|projects"})

    if q and q.strip().startswith("/"):
        raise HTTPException(status_code=400, detail={"code": "BAD_QUERY", "message": "Search query cannot start with '/'"})

    if limit < 1 or limit > settings.search_max_limit:
        raise HTTPException(status_code=400, detail={"code": "BAD_LIMIT", "message": "Limit out of range"})

    tag_values = []
    seen = set()
    for tag in tags:
        value = tag.strip()
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        tag_values.append(value)

    has_readme_bool = _parse_bool(has_readme)
    query = SearchQuery(
        q=q or "",
        scope=scope_normalized,  # type: ignore[arg-type]
        tags=tag_values,
        language=language.lower() if language else None,
        updated_after=updated_after,
        updated_before=updated_before,
        owner=owner,
        has_readme=has_readme_bool,
        limit=limit,
        cursor=cursor,
        project_id=project_id,
        project_slug=project_slug,
    )

    service = get_search_service(engine)
    started = time.perf_counter()
    try:
        response = service.search(query)
    except Exception as exc:  # pragma: no cover - defensive guard for FTS syntax
        log.warning("search_error", error=str(exc), scope=scope_normalized)
        raise HTTPException(status_code=400, detail={"code": "SEARCH_ERROR", "message": "Unable to execute search"}) from exc
    elapsed_ms = (time.perf_counter() - started) * 1000

    results_payload = [
        {
            "type": item.type,
            "id": item.id,
            "name": item.name,
            "path": item.path,
            "project": item.project,
            "tags": item.tags,
            "language": item.language,
            "excerpt": item.excerpt,
            "updated_at": item.updated_at,
            "score": item.score,
        }
        for item in response.results
    ]

    payload: dict[str, Any] = {
        "results": results_payload,
        "next_cursor": response.next_cursor,
    }

    if int(facets or 0) == 1:
        payload["facets"] = service.get_facets(query)

    log.info(
        "search_executed",
        scope=scope_normalized,
        query_length=len(q or ""),
        tag_filters=len(tag_values),
        language=language,
        duration_ms=round(elapsed_ms, 2),
        result_count=len(results_payload),
    )
    return payload


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


@router.get("/facets/tags")
def list_tag_facets(limit: int = 50) -> list[dict[str, Any]]:
    db = SessionLocal()
    try:
        return get_tag_usage(db, limit=limit)
    finally:
        db.close()


@router.post("/index/rebuild")
def rebuild_index() -> dict[str, Any]:
    import redis as _redis
    import rq as _rq

    q = _rq.Queue("default", connection=_redis.from_url(settings.redis_url))
    job = q.enqueue("worker.jobs.search_jobs.reindex_all", job_timeout=600)
    return {"job_id": job.id}
