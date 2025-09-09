from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


def index_file(conn: Connection, file_id: str, content_text: str) -> None:
    conn.execute(text("DELETE FROM search_index WHERE file_id = :fid"), {"fid": file_id})
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

