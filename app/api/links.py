from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import engine
from .models import File, Link
from .search import index_file
from markdown_it import MarkdownIt


WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
_md = MarkdownIt("commonmark").enable("table").enable("strikethrough")


def extract_wikilinks(md_text: str) -> list[str]:
    return [m.group(1).strip() for m in WIKILINK_RE.finditer(md_text)]


def upsert_links(db: Session, project_id: str, src_file: File, md_text: str) -> None:
    # Remove existing links from this source
    db.query(Link).filter(Link.src_file_id == src_file.id).delete(synchronize_session=False)
    titles = extract_wikilinks(md_text)
    if not titles:
        db.commit()
        return
    # Resolve titles to file ids
    files = db.scalars(select(File).where(File.project_id == project_id)).all()
    title_to_file = {f.title: f for f in files}
    for title in titles:
        target = title_to_file.get(title)
        db.add(
            Link(
                project_id=project_id,
                src_file_id=src_file.id,
                src_path=src_file.path,
                target_title=title,
                target_file_id=target.id if target else None,
            )
        )
    db.commit()


def list_outgoing_links(db: Session, file_id: str) -> list[dict[str, str | None | bool]]:
    rows = db.query(Link).filter(Link.src_file_id == file_id).all()
    out: list[dict[str, str | None | bool]] = []
    for l in rows:
        out.append(
            {
                "target_title": l.target_title,
                "target_file_id": l.target_file_id,
                "resolved": l.target_file_id is not None,
            }
        )
    return out


def rewrite_wikilinks(db: Session, project_id: str, old_title: str, new_title: str) -> int:
    # Replace occurrences in content_md and keep rendered_html/search/links in sync
    like = f"%[[{old_title}]]%"
    changed = 0
    files = db.scalars(select(File).where(File.project_id == project_id, File.content_md.like(like))).all()
    for f in files:
        f.content_md = f.content_md.replace(f"[[{old_title}]]", f"[[{new_title}]]")
        f.rendered_html = _md.render(f.content_md)
        db.add(f)
        changed += 1
        # reindex
        with engine.begin() as conn:
            index_file(conn, f.id, f"{f.title}\n{f.content_md}")
        # refresh links for this source
        upsert_links(db, f.project_id, f, f.content_md)
    db.commit()
    return changed
