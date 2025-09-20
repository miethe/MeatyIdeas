from __future__ import annotations

import hashlib
from typing import Iterable, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Project, Tag, project_tags_table
from ..utils import slugify


def _clean_label(label: str) -> str:
    return " ".join(label.strip().split())


def _default_color(slug: str) -> str:
    digest = hashlib.md5(slug.encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def ensure_tags(db: Session, labels: Iterable[str]) -> list[Tag]:
    seen: dict[str, Tag] = {}
    for label in labels:
        if not label:
            continue
        cleaned = _clean_label(label)
        if not cleaned:
            continue
        slug = slugify(cleaned)
        if not slug:
            continue
        if slug in seen:
            continue
        tag = db.scalar(select(Tag).where(Tag.slug == slug))
        if not tag:
            tag = Tag(slug=slug, label=cleaned, color=_default_color(slug))
            db.add(tag)
            db.flush()
        elif tag.label != cleaned:
            tag.label = cleaned
        seen[slug] = tag
    return list(seen.values())


def set_project_tags(db: Session, project: Project, labels: Sequence[str]) -> None:
    tags = ensure_tags(db, labels)
    project.tag_entities = tags


def get_project_tag_details(db: Session, project_ids: Sequence[str]) -> dict[str, list[Tag]]:
    if not project_ids:
        return {}
    stmt = (
        select(project_tags_table.c.project_id, Tag)
        .join(Tag, Tag.id == project_tags_table.c.tag_id)
        .where(project_tags_table.c.project_id.in_(project_ids))
    )
    rows = db.execute(stmt).all()
    out: dict[str, list[Tag]] = {pid: [] for pid in project_ids}
    for project_id, tag in rows:
        out.setdefault(project_id, []).append(tag)
    return out


def get_tag_usage(db: Session, limit: int = 200, q: str | None = None) -> list[dict[str, object]]:
    stmt = (
        select(Tag, func.count(project_tags_table.c.project_id).label("usage"))
        .join(project_tags_table, Tag.id == project_tags_table.c.tag_id, isouter=True)
        .group_by(Tag.id)
        .order_by(func.count(project_tags_table.c.project_id).desc(), Tag.label.asc())
        .limit(limit)
    )
    if q:
        stmt = stmt.where(Tag.label.ilike(f"{q}%"))
    rows = db.execute(stmt).all()
    out: list[dict[str, object]] = []
    for tag, usage in rows:
        out.append(
            {
                "id": tag.id,
                "label": tag.label,
                "slug": tag.slug,
                "color": tag.color,
                "usage_count": int(usage or 0),
                "name": tag.label,
                "count": int(usage or 0),
            }
        )
    return out
