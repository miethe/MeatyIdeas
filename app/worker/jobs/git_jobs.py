from __future__ import annotations

import os

from api.settings import settings as api_settings  # type: ignore
from api.git_ops import ensure_repo, commit_and_push


def connect(slug: str, repo_url: str | None = None) -> dict:
    proj_dir = os.path.join(api_settings.data_dir, "projects", slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    ensure_repo(art_dir, repo_url)
    return {"status": "connected"}


def commit(slug: str, paths: list[str], message: str | None = None) -> dict:
    proj_dir = os.path.join(api_settings.data_dir, "projects", slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    return commit_and_push(art_dir, paths, message)

