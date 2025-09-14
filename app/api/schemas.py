from __future__ import annotations

import datetime as dt
from typing import Any

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str
    message: str


class ProjectCreate(BaseModel):
    name: str
    description: str | None = ""
    tags: list[str] = Field(default_factory=list)
    status: str = "idea"


class ProjectRead(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    tags: list[str]
    status: str
    color: str | None
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True


class FileCreate(BaseModel):
    path: str
    content_md: str
    title: str | None = None
    tags: list[str] = Field(default_factory=list)
    front_matter: dict[str, Any] = Field(default_factory=dict)
    rewrite_links: bool = True


class FileRead(BaseModel):
    id: str
    project_id: str
    path: str
    title: str
    content_md: str
    rendered_html: str
    tags: list[str]
    updated_at: dt.datetime

    class Config:
        from_attributes = True


class ArtifactsConnectRequest(BaseModel):
    repo_url: str | None = None
    provider: str = "local"
    visibility: str = "private"


class ArtifactsCommitRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    message: str | None = None
    push: bool = True


class BundleSelection(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    roles: dict[str, str] = Field(default_factory=dict)

class BundleCreateRequest(BaseModel):
    # Back-compat: allow root-level file_ids but prefer selection
    file_ids: list[str] = Field(default_factory=list)
    selection: BundleSelection | None = None
    include_checksums: bool = True
    push_branch: bool = False
    open_pr: bool = False


class BundleRead(BaseModel):
    id: str
    project_id: str
    status: str
    output_path: str
    created_at: dt.datetime
    error: str | None = None
    bundle_metadata: dict[str, Any] = Field(default_factory=dict)
    branch: str | None = None
    pr_url: str | None = None

    class Config:
        from_attributes = True


class ArtifactsStatus(BaseModel):
    provider: str
    repo_url: str | None
    branch: str | None
    ahead: int
    behind: int
    last_sync: dt.datetime | None


class CommitEntry(BaseModel):
    sha: str
    author: str | None
    message: str
    date: dt.datetime


# M1 — Editor & Links Polish
class LinkInfo(BaseModel):
    target_title: str
    target_file_id: str | None = None
    resolved: bool


class MoveFileRequest(BaseModel):
    new_path: str | None = None
    new_title: str | None = None
    update_links: bool = True
    dry_run: bool = False


class MoveFileDryRunResult(BaseModel):
    will_move: bool
    old_path: str
    new_path: str | None = None
    title_change: dict[str, str] | None = None
    files_to_rewrite: list[dict[str, str]] = Field(default_factory=list)
    rewrite_count: int = 0
    applied: bool = False


class MoveFileApplyResult(MoveFileDryRunResult):
    file: FileRead | None = None


# Search 2.0 — Saved Searches
class SavedSearchCreate(BaseModel):
    name: str
    query: str = ""
    filters: dict[str, Any] = Field(default_factory=dict)


class SavedSearchRead(BaseModel):
    id: str
    name: str
    owner: str | None
    query: str
    filters: dict[str, Any]
    created_at: dt.datetime

    class Config:
        from_attributes = True


# Phase 1 — Profile
class UserRead(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    preferences: dict[str, Any] | None = None


class AppConfig(BaseModel):
    GIT_INTEGRATION: int = 0
    SHARE_LINKS: int = 0
    GROUPS_UI: int = 0
    DIRS_PERSIST: int = 0
    RESULTS_MODAL: int = 1


# Phase 2 — Repos (Git)
class RepoCreate(BaseModel):
    scope: str = "project"  # project | global
    project_id: str | None = None
    provider: str = "local"
    name: str = "repo"
    repo_url: str | None = None
    visibility: str = "private"
    default_branch: str | None = None


class RepoOut(BaseModel):
    id: str
    name: str
    scope: str
    project_id: str | None
    provider: str
    repo_url: str | None
    default_branch: str
    visibility: str
    last_synced_at: dt.datetime | None

    class Config:
        from_attributes = True


class RepoStatus(BaseModel):
    branch: str | None
    ahead: int
    behind: int
    dirty: bool


class Branch(BaseModel):
    name: str
    is_current: bool


# Phase 3 — Directories & Batch Moves
class DirectoryCreate(BaseModel):
    path: str


class DirectoryRead(BaseModel):
    id: str
    project_id: str
    path: str
    name: str
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True


class DirectoryMoveRequest(BaseModel):
    old_path: str
    new_path: str
    dry_run: bool = False


class DirectoryChange(BaseModel):
    old_path: str
    new_path: str


class FileMovePreview(BaseModel):
    file_id: str
    old_path: str
    new_path: str


class DirectoryMoveDryRunResult(BaseModel):
    applied: bool = False
    dir_changes: list[DirectoryChange] = Field(default_factory=list)
    file_moves: list[FileMovePreview] = Field(default_factory=list)
    dirs_count: int = 0
    files_count: int = 0


class DirectoryMoveApplyResult(DirectoryMoveDryRunResult):
    applied: bool = True


class DirectoryDeleteRequest(BaseModel):
    path: str
    force: bool = False


class DirectoryDeleteResult(BaseModel):
    deleted: bool
    removed_dirs: int = 0


class FilesBatchMoveRequest(BaseModel):
    files: list[dict[str, str]] = Field(default_factory=list)  # {file_id, to_project_id?, new_path}
    dirs: list[dict[str, str]] = Field(default_factory=list)   # {path, from_project_id, to_project_id?, new_path}
    update_links: bool = True
    dry_run: bool = False


class FilesBatchMoveResult(BaseModel):
    applied: bool
    moved_files: list[FileMovePreview] = Field(default_factory=list)
    moved_dirs: list[DirectoryChange] = Field(default_factory=list)
    failures: list[str] = Field(default_factory=list)
    files_count: int = 0
    dirs_count: int = 0


# Phase 4 — Import/Export
class ProjectExportSelection(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    include_paths: list[str] = Field(default_factory=list)


class ProjectExportRequest(BaseModel):
    mode: str = "zip"  # zip | json
    selection: ProjectExportSelection | None = None


class JobEnqueueResponse(BaseModel):
    job_id: str
    result_url: str | None = None


# Phase 4 — Share Links
class ShareLinkCreate(BaseModel):
    expires_at: dt.datetime | None = None
    allow_export: bool = False


class ShareLinkRead(BaseModel):
    id: str
    project_id: str
    token: str
    permissions: str
    expires_at: dt.datetime | None
    revoked_at: dt.datetime | None
    created_at: dt.datetime

    class Config:
        from_attributes = True
