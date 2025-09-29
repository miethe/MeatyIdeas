from __future__ import annotations

import json
from typing import Iterator

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..schemas import (
    AppConfig,
    FileTypeOption,
    ProjectStatusOption,
    ProjectTemplateOption,
)
from ..settings import settings
from ..services.file_types import list_file_type_options


router = APIRouter(prefix="/config", tags=["config"])


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DEFAULT_STATUS_OPTIONS = [
    ProjectStatusOption(key="idea", label="Idea"),
    ProjectStatusOption(key="discovery", label="Discovery"),
    ProjectStatusOption(key="draft", label="Draft"),
    ProjectStatusOption(key="live", label="Live"),
    ProjectStatusOption(key="archived", label="Archived"),
]


def _load_status_options() -> list[ProjectStatusOption]:
    raw = settings.project_statuses
    if not raw:
        return DEFAULT_STATUS_OPTIONS
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return DEFAULT_STATUS_OPTIONS
    if not isinstance(data, list):
        return DEFAULT_STATUS_OPTIONS
    result: list[ProjectStatusOption] = []
    for entry in data:
        if isinstance(entry, str):
            key = entry.strip().lower()
            if not key:
                continue
            result.append(ProjectStatusOption(key=key, label=key.title()))
            continue
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("key") or entry.get("id") or "").strip()
        if not key:
            continue
        label = str(entry.get("label") or entry.get("name") or key.title()).strip() or key.title()
        color = entry.get("color")
        result.append(ProjectStatusOption(key=key, label=label, color=color))
    return result or DEFAULT_STATUS_OPTIONS


DEFAULT_PROJECT_TEMPLATES = [
    ProjectTemplateOption(key="blank", label="Blank", description="Start from scratch"),
]


def _load_project_templates() -> list[ProjectTemplateOption]:
    raw = settings.project_templates
    if not raw:
        return DEFAULT_PROJECT_TEMPLATES
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return DEFAULT_PROJECT_TEMPLATES
    if not isinstance(data, list):
        return DEFAULT_PROJECT_TEMPLATES
    templates: list[ProjectTemplateOption] = []
    for entry in data:
        if isinstance(entry, str):
            key = entry.strip().lower().replace(" ", "-")
            label = entry.strip() or key.title()
            if key:
                templates.append(ProjectTemplateOption(key=key, label=label))
            continue
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("key") or entry.get("id") or "").strip()
        label = str(entry.get("label") or entry.get("name") or key.title()).strip() or key.title()
        description = entry.get("description")
        if not key:
            key = label.lower().replace(" ", "-")
        key = key.replace(" ", "-").lower()
        if not key:
            continue
        templates.append(ProjectTemplateOption(key=key, label=label, description=description))
    return templates or DEFAULT_PROJECT_TEMPLATES


_CONFIG_CACHE: AppConfig | None = None


def invalidate_config_cache() -> None:
    global _CONFIG_CACHE
    _CONFIG_CACHE = None


@router.get("", response_model=AppConfig)
def get_config(db: Session = Depends(get_db)):
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    config = AppConfig(
        GIT_INTEGRATION=int(settings.git_integration or 0),
        SHARE_LINKS=int(settings.share_links or 0),
        GROUPS_UI=int(settings.groups_ui or 0),
        DIRS_PERSIST=int(settings.dirs_persist or 0),
        RESULTS_MODAL=int(settings.results_modal or 1),
        SEARCH_V2=int(settings.search_v2 or 0),
        SEARCH_MODAL_V2=int(settings.search_modal_v2 or 0),
        SEARCH_FILTERS_V2=int(settings.search_filters_v2 or 0),
        TAGS_V2=int(settings.tags_v2 or 0),
        PROJECT_MODAL=int(settings.project_modal or 0),
        UX_CREATION_DASHBOARD_REFRESH=int(settings.ux_creation_dashboard_refresh or 0),
        PROJECT_STATUS_OPTIONS=_load_status_options(),
        FILE_TYPE_OPTIONS=list_file_type_options(db),
        PROJECT_TEMPLATES=_load_project_templates(),
        CONFIG_VERSION=settings.config_version or "2025-09-27-set2",
    )
    _CONFIG_CACHE = config
    return config
