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


class BundleCreateRequest(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    include_checksums: bool = True
    push_branch: bool = False


class BundleCreateResponse(BaseModel):
    zip_path: str
    branch: str | None = None

