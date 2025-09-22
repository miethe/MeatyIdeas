from __future__ import annotations

import datetime as dt
from typing import Any, Literal

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
    is_starred: bool = False
    is_archived: bool = False
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True


class ProjectCardTag(BaseModel):
    label: str
    slug: str
    color: str | None = None
    usage_count: int | None = None


class ProjectCardOwner(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class ProjectCardHighlight(BaseModel):
    title: str | None = None
    snippet: str | None = None
    path: str | None = None


class ProjectCardLanguageStat(BaseModel):
    language: str
    count: int


class ProjectCardRead(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    status: str
    color: str | None = None
    tags: list[str] = Field(default_factory=list)
    tag_details: list[ProjectCardTag] = Field(default_factory=list)
    is_starred: bool = False
    is_archived: bool = False
    created_at: dt.datetime
    updated_at: dt.datetime
    file_count: int = 0
    language_mix: list[ProjectCardLanguageStat] = Field(default_factory=list)
    owners: list[ProjectCardOwner] = Field(default_factory=list)
    highlight: ProjectCardHighlight | None = None
    activity_sparkline: list[int] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectCardRead]
    next_cursor: str | None = None
    total: int = 0
    limit: int = 0
    view: str = "all"
    filters: dict[str, Any] = Field(default_factory=dict)


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
    SEARCH_V2: int = 1
    SEARCH_MODAL_V2: int = 1
    SEARCH_FILTERS_V2: int = 1
    TAGS_V2: int = 1
    PROJECT_MODAL: int = 0


class ProjectModalQuickStat(BaseModel):
    id: str
    label: str
    value: str
    subvalue: str | None = None
    timestamp: dt.datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProjectModalSummary(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    status: str
    updated_at: dt.datetime | None
    is_starred: bool
    tags: list[ProjectCardTag] = Field(default_factory=list)
    owners: list[ProjectCardOwner] = Field(default_factory=list)
    file_count: int
    directory_count: int
    language_mix: list[ProjectCardLanguageStat] = Field(default_factory=list)
    readme_path: str | None = None
    highlight: ProjectCardHighlight | None = None
    quick_stats: list[ProjectModalQuickStat] = Field(default_factory=list)


class ProjectTreeNode(BaseModel):
    type: Literal['dir', 'file']
    name: str
    path: str
    depth: int
    parent_path: str | None = None
    file_id: str | None = None
    updated_at: dt.datetime | None = None
    size: int | None = None
    has_children: bool | None = None
    children_count: int | None = None
    preview_eligible: bool | None = None
    badges: list[str] = Field(default_factory=list)
    language: str | None = None
    extension: str | None = None


class ProjectTreeResponse(BaseModel):
    items: list[ProjectTreeNode]
    next_cursor: str | None = None
    total: int = 0


class ProjectActivityEntry(BaseModel):
    id: str
    type: str
    message: str
    timestamp: dt.datetime
    actor: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class ProjectActivityResponse(BaseModel):
    items: list[ProjectActivityEntry]
    next_cursor: str | None = None
    sources: list[str] = Field(default_factory=list)


class FilePreviewResponse(BaseModel):
    id: str
    project_id: str
    path: str
    title: str
    size: int
    mime_type: str | None = None
    encoding: str = "utf-8"
    content: str | None = None
    rendered_html: str | None = None
    is_truncated: bool = False
    preview_type: str = "text"
    preview_url: str | None = None
    language: str | None = None
    updated_at: dt.datetime


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
    allow_export: bool
    expires_at: dt.datetime | None
    revoked_at: dt.datetime | None
    created_at: dt.datetime

    class Config:
        from_attributes = True


# Phase 5 — Project Groups
class ProjectGroupCreate(BaseModel):
    name: str
    color: str | None = None
    sort_order: int | None = None


class ProjectGroupUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    sort_order: int | None = None


class ProjectGroupRead(BaseModel):
    id: str
    name: str
    color: str | None
    sort_order: int

    class Config:
        from_attributes = True


class ProjectGroupWithProjects(ProjectGroupRead):
    projects: list[ProjectRead] = Field(default_factory=list)


class GroupAssignRequest(BaseModel):
    project_id: str
    position: int | None = None
