from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from sqlalchemy import text

from ..db import engine


router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(
    q: str,
    project_id: str | None = None,
    tag: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    # FTS5 with snippet and basic filters. Join files/projects for metadata.
    sql = (
        """
        SELECT f.id as file_id,
               f.title as title,
               f.path as path,
               p.id as project_id,
               snippet(search_index, 1, '[', ']', '...', 8) as snippet,
               bm25(search_index) as score
        FROM search_index
        JOIN files f ON f.id = search_index.file_id
        JOIN projects p ON p.id = f.project_id
        WHERE search_index MATCH :q
        {and_project}
        {and_status}
        {and_tag}
        ORDER BY score ASC, f.updated_at DESC
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
        # SQLite JSON contains check: files.tags is a JSON array; simple LIKE fallback for MVP
        and_tag = " AND json_array_length(f.tags) > 0 AND f.tags LIKE :tag_like"
        params["tag_like"] = f"%{tag}%"

    sql = sql.format(and_project=and_project, and_status=and_status, and_tag=and_tag)
    with engine.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()
    return [dict(r) for r in rows]
