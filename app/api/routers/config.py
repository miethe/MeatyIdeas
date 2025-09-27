from __future__ import annotations

from fastapi import APIRouter
import json

from ..schemas import AppConfig, ProjectStatusOption
from ..settings import settings


router = APIRouter(prefix="/config", tags=["config"])


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


@router.get("", response_model=AppConfig)
def get_config():
    return AppConfig(
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
    )
