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
    UniqueConstraint,
    Integer,
    Boolean,
    Table,
)
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


StatusEnum = ("idea", "discovery", "draft", "live")
VisibilityEnum = ("public", "private")
ProviderEnum = ("github", "gitlab", "bitbucket", "local")
ScopeEnum = ("project", "global")


def now_utc() -> dt.datetime:
    return dt.datetime.now(tz=dt.timezone.utc)


project_tags_table = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(Enum(*StatusEnum, name="status_enum"), default="idea")
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )

    files: Mapped[list["File"]] = relationship("File", back_populates="project")
    artifacts: Mapped[list["ArtifactRepo"]] = relationship("ArtifactRepo", back_populates="project")
    repos: Mapped[list["Repo"]] = relationship("Repo", back_populates="project")
    # Directories relationship added in Phase 3
    directories: Mapped[list["Directory"]] = relationship("Directory", back_populates="project")
    tag_entities: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=project_tags_table,
        back_populates="projects",
        cascade="save-update",
    )

    @property
    def tags(self) -> list[str]:
        return [tag.label for tag in self.tag_entities]


class User(Base):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(String, primary_key=True, default="local")
    name: Mapped[str] = mapped_column(String, default="Local User")
    email: Mapped[str] = mapped_column(String, default="")
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


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


class Directory(Base):
    __tablename__ = "directories"
    __table_args__ = (UniqueConstraint("project_id", "path", name="uix_directory_project_path"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    project: Mapped[Project] = relationship("Project", back_populates="directories")


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


class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    scope: Mapped[str] = mapped_column(Enum(*ScopeEnum, name="scope_enum"), default="project")
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    provider: Mapped[str] = mapped_column(Enum(*ProviderEnum, name="provider_enum"), default="local")
    repo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    default_branch: Mapped[str] = mapped_column(String, default="main")
    visibility: Mapped[str] = mapped_column(Enum(*VisibilityEnum, name="visibility_enum"), default="private")
    last_synced_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project | None] = relationship("Project", back_populates="repos")


class Bundle(Base):
    __tablename__ = "bundles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    selection: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    output_path: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="completed")
    error: Mapped[str] = mapped_column(Text, default="")
    bundle_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
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


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    owner: Mapped[str | None] = mapped_column(String, nullable=True, default="default")
    query: Mapped[str] = mapped_column(String, default="")
    filters: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


# Phase 4 — Share Links
class ShareLink(Base):
    __tablename__ = "share_links"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    token: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    permissions: Mapped[str] = mapped_column(String, default="read")
    allow_export: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    __table_args__ = (
        UniqueConstraint("token", name="uq_share_links_token"),
    )


# Phase 5 — Project Groups
class ProjectGroup(Base):
    __tablename__ = "project_groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    memberships: Mapped[list["ProjectGroupMembership"]] = relationship(
        "ProjectGroupMembership",
        cascade="all, delete-orphan",
        primaryjoin="ProjectGroup.id==ProjectGroupMembership.group_id",
        order_by="ProjectGroupMembership.sort_order",
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    projects: Mapped[list[Project]] = relationship(
        "Project",
        secondary=project_tags_table,
        back_populates="tag_entities",
    )


class ProjectGroupMembership(Base):
    __tablename__ = "project_group_memberships"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_group_membership_project"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    group_id: Mapped[str] = mapped_column(String, ForeignKey("project_groups.id"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
