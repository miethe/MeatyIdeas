from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import (
    Column,
    String,
    Text,
    Enum,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


StatusEnum = ("idea", "discovery", "draft", "live")
VisibilityEnum = ("public", "private")
ProviderEnum = ("github", "gitlab", "bitbucket", "local")


def now_utc() -> dt.datetime:
    return dt.datetime.now(tz=dt.timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(Enum(*StatusEnum, name="status_enum"), default="idea")
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )

    files: Mapped[list["File"]] = relationship("File", back_populates="project")
    artifacts: Mapped[list["ArtifactRepo"]] = relationship("ArtifactRepo", back_populates="project")


class File(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    front_matter: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    content_md: Mapped[str] = mapped_column(Text, default="")
    rendered_html: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship("Project", back_populates="files")


class ArtifactRepo(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    repo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    default_branch: Mapped[str] = mapped_column(String, default="main")
    visibility: Mapped[str] = mapped_column(Enum(*VisibilityEnum, name="visibility_enum"), default="private")
    provider: Mapped[str] = mapped_column(Enum(*ProviderEnum, name="provider_enum"), default="local")
    last_synced_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship("Project", back_populates="artifacts")


class Bundle(Base):
    __tablename__ = "bundles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    selection: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    output_path: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="completed")
    error: Mapped[str] = mapped_column(Text, default="")
    metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    branch: Mapped[str | None] = mapped_column(String, nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Link(Base):
    __tablename__ = "links"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    src_file_id: Mapped[str] = mapped_column(String, ForeignKey("files.id"), nullable=False)
    src_path: Mapped[str] = mapped_column(String, nullable=False)
    target_title: Mapped[str] = mapped_column(String, nullable=False)
    target_file_id: Mapped[str | None] = mapped_column(String, ForeignKey("files.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
