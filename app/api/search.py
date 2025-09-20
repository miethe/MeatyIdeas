from __future__ import annotations

import datetime as dt
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable, Literal

from sqlalchemy import TextClause, func, text
from sqlalchemy.engine import Connection, Engine

from .utils import slugify


def _fts_columns(conn: Connection) -> list[str]:
    rows = conn.exec_driver_sql("PRAGMA table_info('search_index')").fetchall()
    return [r[1] for r in rows]


def _detect_language(path: str | None) -> str:
    if not path:
        return "unknown"
    ext = (path.rsplit(".", 1)[-1] if "." in path else "").lower()
    if ext in {"md", "markdown"}:
        return "markdown"
    if ext in {"py"}:
        return "python"
    if ext in {"ts", "tsx"}:
        return "typescript"
    if ext in {"js", "jsx"}:
        return "javascript"
    if ext in {"json"}:
        return "json"
    if ext in {"yaml", "yml"}:
        return "yaml"
    if ext in {"css", "scss"}:
        return "css"
    if ext in {"html"}:
        return "html"
    if ext in {"sh"}:
        return "shell"
    if ext in {"rb"}:
        return "ruby"
    if ext in {"go"}:
        return "go"
    if ext in {"rs"}:
        return "rust"
    return ext or "unknown"


def _fetch_file_metadata(conn: Connection, file_id: str) -> dict[str, Any] | None:
    sql = text(
        """
        SELECT f.id as file_id,
               f.path as path,
               f.title as title,
               f.updated_at as file_updated,
               p.id as project_id,
               p.slug as project_slug,
               p.name as project_name,
               p.is_archived as is_archived,
               p.status as project_status,
               GROUP_CONCAT(DISTINCT t.slug) as tag_slugs
        FROM files f
        JOIN projects p ON p.id = f.project_id
        LEFT JOIN project_tags pt ON pt.project_id = p.id
        LEFT JOIN tags t ON t.id = pt.tag_id
        WHERE f.id = :fid
        GROUP BY f.id, p.id
        """
    )
    row = conn.execute(sql, {"fid": file_id}).mappings().first()
    if not row:
        return None
    tags_text = row.get("tag_slugs") or ""
    unique_slugs = []
    for token in tags_text.split(","):
        slug = token.strip()
        if slug and slug not in unique_slugs:
            unique_slugs.append(slug)
    return {
        "file_id": row.get("file_id"),
        "path": row.get("path") or "",
        "title": row.get("title") or "",
        "updated_at": row.get("file_updated"),
        "project_id": row.get("project_id"),
        "project_slug": row.get("project_slug") or "",
        "project_name": row.get("project_name") or "",
        "is_archived": bool(row.get("is_archived")),
        "project_status": row.get("project_status") or "",
        "tags": unique_slugs,
    }


def index_file(conn: Connection, file_id: str, content_text: str, title: str | None = None, path: str | None = None) -> None:
    cols = _fts_columns(conn)
    conn.execute(text("DELETE FROM search_index WHERE file_id = :fid"), {"fid": file_id})
    metadata = _fetch_file_metadata(conn, file_id)
    if metadata is None:
        return
    resolved_title = title or metadata.get("title") or ""
    resolved_path = path or metadata.get("path") or ""
    language = _detect_language(resolved_path)
    tags_blob = " " + " ".join(metadata.get("tags", [])) + " " if metadata.get("tags") else ""
    updated_at = metadata.get("updated_at")
    updated_iso = updated_at.isoformat() if isinstance(updated_at, dt.datetime) else (updated_at or "")
    row = {
        "fid": file_id,
        "project_id": metadata.get("project_id"),
        "project_slug": metadata.get("project_slug"),
        "project_name": metadata.get("project_name"),
        "title": resolved_title,
        "body": content_text,
        "path": resolved_path,
        "tags": tags_blob,
        "language": language,
        "updated_at": updated_iso,
        "is_archived": "1" if metadata.get("is_archived") else "0",
        "project_status": metadata.get("project_status"),
    }
    if {"body", "title", "project_id"}.issubset(cols):
        conn.execute(
            text(
                """
                INSERT INTO search_index (
                    file_id,
                    project_id,
                    project_slug,
                    project_name,
                    title,
                    body,
                    path,
                    tags,
                    language,
                    updated_at,
                    is_archived,
                    project_status
                ) VALUES (
                    :fid,
                    :project_id,
                    :project_slug,
                    :project_name,
                    :title,
                    :body,
                    :path,
                    :tags,
                    :language,
                    :updated_at,
                    :is_archived,
                    :project_status
                )
                """
            ),
            row,
        )
    else:
        conn.execute(
            text("INSERT INTO search_index (file_id, content_text) VALUES (:fid, :ct)"),
            {"fid": file_id, "ct": content_text},
        )


@dataclass
class SearchQuery:
    q: str
    scope: Literal["projects", "files", "all"] = "all"
    tags: list[str] | None = None
    language: str | None = None
    updated_after: str | None = None
    updated_before: str | None = None
    owner: str | None = None
    has_readme: bool | None = None
    limit: int = 20
    cursor: str | None = None
    project_id: str | None = None
    project_slug: str | None = None


@dataclass
class SearchResult:
    type: Literal["file", "project"]
    id: str
    name: str
    path: str | None
    project: dict[str, Any] | None
    tags: list[str]
    excerpt: str | None
    updated_at: str | None
    score: float
    language: str | None = None


@dataclass
class SearchResponse:
    results: list[SearchResult]
    next_cursor: str | None


class SearchService:
    def __init__(self, engine: Engine):
        self.engine = engine

    def _parse_cursor(self, cursor: str | None) -> int:
        if not cursor:
            return 0
        try:
            return max(int(cursor), 0)
        except ValueError:
            return 0

    def search(self, query: SearchQuery) -> SearchResponse:
        offset = self._parse_cursor(query.cursor)
        limit = max(1, min(query.limit, 50))
        if query.scope == "projects":
            projects, has_more, next_offset = self._search_projects(query, limit, offset)
            return SearchResponse(results=projects, next_cursor=str(next_offset) if has_more else None)
        if query.scope == "files":
            files, has_more, next_offset = self._search_files(query, limit, offset)
            return SearchResponse(results=files, next_cursor=str(next_offset) if has_more else None)

        project_slice = min(max(limit // 3, 1), 5)
        projects, _, _ = self._search_projects(query, project_slice, 0)
        files, has_more, next_offset = self._search_files(query, limit, offset)
        combined = (projects + files)[:limit]
        return SearchResponse(results=combined, next_cursor=str(next_offset) if has_more else None)

    def _search_files(self, query: SearchQuery, limit: int, offset: int) -> tuple[list[SearchResult], bool, int | None]:
        expressions: list[str] = []
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        cleaned = query.q.strip()
        if cleaned:
            expressions.append("search_index MATCH :match")
            params["match"] = cleaned
        else:
            expressions.append("1=1")

        if query.tags:
            for idx, label in enumerate(query.tags):
                slug = slugify(label)
                params[f"tag{idx}"] = f"% {slug} %"
                expressions.append(f"tags LIKE :tag{idx}")

        if query.language:
            params["language"] = query.language.lower()
            expressions.append("lower(language) = :language")

        if query.updated_after:
            params["updated_after"] = query.updated_after
            expressions.append("(updated_at IS NOT NULL AND updated_at >= :updated_after)")
        if query.updated_before:
            params["updated_before"] = query.updated_before
            expressions.append("(updated_at IS NOT NULL AND updated_at <= :updated_before)")

        if query.scope != "projects":
            # Files scope includes check for archived projects (exclude by default)
            expressions.append("is_archived = '0'")

        if query.project_id:
            params["project_id_filter"] = query.project_id
            expressions.append("project_id = :project_id_filter")
        if query.project_slug:
            params["project_slug_filter"] = query.project_slug
            expressions.append("project_slug = :project_slug_filter")

        where_clause = " AND ".join(expressions) if expressions else "1=1"
        sql = f"""
            SELECT
                file_id,
                project_id,
                project_slug,
                project_name,
                title,
                path,
                tags,
                language,
                updated_at,
                bm25(search_index) as score,
                snippet(search_index, 5, '[', ']', '…', 8) as excerpt
            FROM search_index
            WHERE {where_clause}
            ORDER BY score ASC, updated_at DESC
            LIMIT :limit OFFSET :offset
        """

        with self.engine.connect() as conn:
            rows = conn.execute(text(sql), params).mappings().all()

        results: list[SearchResult] = []
        for row in rows:
            tags = [slug for slug in (row.get("tags") or "").split() if slug]
            result = SearchResult(
                type="file",
                id=row.get("file_id"),
                name=row.get("title") or row.get("path") or "Untitled",
                path=row.get("path"),
                project={
                    "id": row.get("project_id"),
                    "slug": row.get("project_slug"),
                    "name": row.get("project_name"),
                },
                tags=tags,
                excerpt=row.get("excerpt"),
                updated_at=row.get("updated_at"),
                score=float(row.get("score") or 0.0),
                language=row.get("language"),
            )
            results.append(result)

        has_more = len(results) == limit
        next_offset = offset + limit if has_more else None
        return results, has_more, next_offset

    def _search_projects(self, query: SearchQuery, limit: int, offset: int) -> tuple[list[SearchResult], bool, int | None]:
        params: dict[str, Any] = {"limit": limit, "offset": offset}
        clauses: list[str] = ["p.is_archived = 0"]
        cleaned = query.q.strip().lower()
        if cleaned:
            params["pattern"] = f"%{cleaned}%"
            clauses.append("(lower(p.name) LIKE :pattern OR lower(p.description) LIKE :pattern)")

        if query.tags:
            for idx, label in enumerate(query.tags):
                slug = slugify(label)
                params[f"ptag{idx}"] = slug
                clauses.append(
                    f"EXISTS (SELECT 1 FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.project_id = p.id AND t.slug = :ptag{idx})"
                )

        if query.updated_after:
            params["p_updated_after"] = query.updated_after
            clauses.append("p.updated_at >= :p_updated_after")
        if query.updated_before:
            params["p_updated_before"] = query.updated_before
            clauses.append("p.updated_at <= :p_updated_before")

        if query.has_readme:
            clauses.append(
                "EXISTS (SELECT 1 FROM files pf WHERE pf.project_id = p.id AND lower(pf.path) LIKE '%readme%')"
            )

        if query.project_id:
            params["p_project_id"] = query.project_id
            clauses.append("p.id = :p_project_id")
        if query.project_slug:
            params["p_project_slug"] = query.project_slug
            clauses.append("p.slug = :p_project_slug")

        where_clause = " AND ".join(clauses) if clauses else "1=1"
        sql = f"""
            SELECT
                p.id,
                p.name,
                p.slug,
                p.description,
                p.updated_at,
                GROUP_CONCAT(DISTINCT t.slug) as tag_slugs
            FROM projects p
            LEFT JOIN project_tags pt ON pt.project_id = p.id
            LEFT JOIN tags t ON t.id = pt.tag_id
            WHERE {where_clause}
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            LIMIT :limit OFFSET :offset
        """

        with self.engine.connect() as conn:
            rows = conn.execute(text(sql), params).mappings().all()

        results: list[SearchResult] = []
        for row in rows:
            raw_tags = row.get("tag_slugs") or ""
            tags = [slug for slug in raw_tags.split(",") if slug]
            description = row.get("description") or ""
            excerpt = description[:200] + ("…" if len(description) > 200 else "") if description else None
            results.append(
                SearchResult(
                    type="project",
                    id=row.get("id"),
                    name=row.get("name"),
                    path=None,
                    project={
                        "id": row.get("id"),
                        "slug": row.get("slug"),
                        "name": row.get("name"),
                    },
                    tags=tags,
                    excerpt=excerpt,
                    updated_at=row.get("updated_at").isoformat() if isinstance(row.get("updated_at"), dt.datetime) else row.get("updated_at"),
                    score=0.0,
                    language=None,
                )
            )

        has_more = len(results) == limit
        next_offset = offset + limit if has_more else None
        return results, has_more, next_offset

    def get_facets(self, query: SearchQuery) -> dict[str, list[dict[str, Any]]]:
        facet_query = SearchQuery(
            q=query.q,
            scope="files" if query.scope != "projects" else "projects",
            tags=query.tags,
            language=query.language,
            updated_after=query.updated_after,
            updated_before=query.updated_before,
            owner=query.owner,
            has_readme=query.has_readme,
            limit=200,
            cursor=None,
        )

        if facet_query.scope == "projects":
            projects, _, _ = self._search_projects(facet_query, limit=200, offset=0)
            tag_counts: Counter[str] = Counter()
            for proj in projects:
                for tag in proj.tags:
                    tag_counts[tag] += 1
            return {
                "tags": self._hydrate_tag_facets(tag_counts),
                "languages": [],
            }

        files, _, _ = self._search_files(facet_query, limit=200, offset=0)
        tag_counts: Counter[str] = Counter()
        language_counts: Counter[str] = Counter()
        for res in files:
            for tag in res.tags:
                tag_counts[tag] += 1
            if res.language:
                language_counts[res.language] += 1

        return {
            "tags": self._hydrate_tag_facets(tag_counts),
            "languages": [
                {"label": lang, "slug": lang, "count": count}
                for lang, count in sorted(language_counts.items(), key=lambda item: (-item[1], item[0]))
            ],
        }

    def _hydrate_tag_facets(self, tag_counts: Counter[str]) -> list[dict[str, Any]]:
        if not tag_counts:
            return []
        slugs = list(tag_counts.keys())
        placeholders = ",".join([f":slug{i}" for i in range(len(slugs))])
        params = {f"slug{i}": slug for i, slug in enumerate(slugs)}
        query = text(f"SELECT slug, label, color FROM tags WHERE slug IN ({placeholders})")
        meta: dict[str, dict[str, Any]] = {}
        with self.engine.connect() as conn:
            rows = conn.execute(query, params).mappings().all()
        for row in rows:
            meta[row["slug"]] = {"label": row["label"], "color": row.get("color")}
        facets: list[dict[str, Any]] = []
        for slug, count in sorted(tag_counts.items(), key=lambda item: (-item[1], item[0])):
            info = meta.get(slug, {"label": slug, "color": None})
            facets.append(
                {
                    "label": info["label"],
                    "slug": slug,
                    "color": info.get("color"),
                    "count": int(count),
                }
            )
        return facets


search_service: SearchService | None = None


def get_search_service(engine: Engine) -> SearchService:
    global search_service
    if search_service is None:
        search_service = SearchService(engine)
    return search_service
