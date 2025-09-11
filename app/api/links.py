from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import File, Link


WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


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


def rewrite_wikilinks(db: Session, project_id: str, old_title: str, new_title: str) -> int:
    # Best-effort: replace occurrences in content_md
    like = f"%[[{old_title}]]%"
    changed = 0
    for f in db.scalars(select(File).where(File.project_id == project_id, File.content_md.like(like))).all():
        f.content_md = f.content_md.replace(f"[[{old_title}]]", f"[[{new_title}]]")
        db.add(f)
        changed += 1
    db.commit()
    return changed

