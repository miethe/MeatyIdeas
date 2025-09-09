from __future__ import annotations

import os

from api.settings import settings as api_settings  # type: ignore
from api.bundle import export_bundle


def export(slug: str, project_name: str, file_rel_paths: list[str]) -> dict:
    proj_dir = os.path.join(api_settings.data_dir, "projects", slug)
    zip_path = export_bundle(project_name=project_name, project_slug=slug, project_dir=proj_dir, file_rel_paths=file_rel_paths)
    return {"zip_path": zip_path}

