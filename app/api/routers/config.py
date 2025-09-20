from __future__ import annotations

from fastapi import APIRouter

from ..schemas import AppConfig
from ..settings import settings


router = APIRouter(prefix="/config", tags=["config"])


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
    )
