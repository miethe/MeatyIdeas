from __future__ import annotations

import json
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import FileType
from ..schemas import FileTypeOption
from ..settings import settings
from ..utils import slugify


DEFAULT_FILE_TYPES: Sequence[FileTypeOption] = (
    FileTypeOption(key="prd", label="PRD"),
    FileTypeOption(key="task", label="Task"),
    FileTypeOption(key="idea", label="Idea"),
    FileTypeOption(key="note", label="Note"),
)


def _clean_label(label: str) -> str:
    return " ".join(label.strip().split())


def _load_file_types_from_settings() -> list[FileTypeOption]:
    raw = settings.file_types
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    options: list[FileTypeOption] = []
    for entry in data:
        if isinstance(entry, str):
            cleaned = _clean_label(entry)
            if not cleaned:
                continue
            slug = slugify(cleaned)
            options.append(FileTypeOption(key=slug, label=cleaned))
            continue
        if not isinstance(entry, dict):
            continue
        label = _clean_label(str(entry.get("label") or entry.get("name") or ""))
        if not label:
            continue
        slug = str(entry.get("key") or entry.get("id") or slugify(label)).strip()
        slug = slugify(slug or label)
        color = entry.get("color")
        icon = entry.get("icon")
        options.append(FileTypeOption(key=slug, label=label, color=color, icon=icon))
    return options


def list_file_type_options(db: Session) -> list[FileTypeOption]:
    options: dict[str, FileTypeOption] = {opt.key: opt for opt in DEFAULT_FILE_TYPES}
    for opt in _load_file_types_from_settings():
        options[opt.key] = opt
    rows = db.scalars(select(FileType).order_by(FileType.label.asc())).all()
    for row in rows:
        options[row.slug] = FileTypeOption(key=row.slug, label=row.label, color=row.color, icon=row.icon)
    return list(options.values())


def ensure_file_type(
    db: Session,
    label: str,
    color: str | None = None,
    icon: str | None = None,
) -> tuple[FileType, bool]:
    cleaned = _clean_label(label)
    if not cleaned:
        raise ValueError("Label is required")
    slug = slugify(cleaned)
    existing = db.scalar(select(FileType).where(FileType.slug == slug))
    if existing:
        updated = False
        if existing.label != cleaned:
            existing.label = cleaned
            updated = True
        if color is not None and existing.color != color:
            existing.color = color
            updated = True
        if icon is not None and existing.icon != icon:
            existing.icon = icon
            updated = True
        if updated:
            db.add(existing)
            db.commit()
            db.refresh(existing)
        return existing, False
    ft = FileType(slug=slug, label=cleaned, color=color, icon=icon)
    db.add(ft)
    db.commit()
    db.refresh(ft)
    return ft, True


def bulk_ensure_file_types(db: Session, labels: Iterable[str]) -> list[FileType]:
    created: list[FileType] = []
    for label in labels:
        if not label:
            continue
        try:
            item, _ = ensure_file_type(db, label)
            created.append(item)
        except ValueError:
            continue
    return created


def as_option(file_type: FileType) -> FileTypeOption:
    return FileTypeOption(key=file_type.slug, label=file_type.label, color=file_type.color, icon=file_type.icon)
