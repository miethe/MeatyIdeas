from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


def _fts_columns(conn: Connection) -> list[str]:
    # Returns list of column names for search_index (fts5)
    rows = conn.exec_driver_sql("PRAGMA table_info('search_index')").fetchall()
    return [r[1] for r in rows]


def index_file(conn: Connection, file_id: str, content_text: str, title: str | None = None, path: str | None = None) -> None:
    cols = _fts_columns(conn)
    conn.execute(text("DELETE FROM search_index WHERE file_id = :fid"), {"fid": file_id})
    if "body" in cols and "title" in cols:
        # New multi-column schema: (file_id, title, body, path)
        conn.execute(
            text("INSERT INTO search_index (file_id, title, body, path) VALUES (:fid, :tt, :bd, :pth)"),
            {"fid": file_id, "tt": title or "", "bd": content_text, "pth": path or ""},
        )
    else:
        # Legacy single-column schema
        conn.execute(
            text("INSERT INTO search_index (file_id, content_text) VALUES (:fid, :ct)"),
            {"fid": file_id, "ct": content_text},
        )


def search(conn: Connection, query: str, limit: int = 20) -> list[str]:
    # Use FTS5 match
    rows = conn.execute(
        text("SELECT file_id FROM search_index WHERE search_index MATCH :q LIMIT :lim"),
        {"q": query, "lim": limit},
    ).fetchall()
    return [r[0] for r in rows]
