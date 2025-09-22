from __future__ import annotations

import json
import os
import mimetypes
import hashlib
import datetime as dt
from email.utils import format_datetime
from threading import Lock
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import Project, File, ArtifactRepo, Bundle, User, Tag, Directory, Event, ProjectGroup, ProjectGroupMembership
from ..schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectRead,
    ProjectCardRead,
    ProjectCardLanguageStat,
    ProjectCardOwner,
    ProjectCardTag,
    ProjectCardHighlight,
    ProjectListResponse,
    FileRead,
    ProjectModalSummary,
    ProjectModalQuickStat,
    ProjectTreeResponse,
    ProjectTreeNode,
    TagSummary,
    ProjectActivityResponse,
    ProjectActivityEntry,
    ProjectGroupRead,
)
from ..settings import settings
from ..utils import slugify, safe_join
import shutil
from ..services.tagging import get_project_tag_details, set_project_tags
from ..services.frontmatter import build_tag_details, extract_front_matter, summarize_markdown
from ..git_ops import repo_history, GitError


router = APIRouter(prefix="/projects", tags=["projects"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_MODAL_CACHE: Dict[str, Tuple[str, ProjectModalSummary, dt.datetime | None]] = {}
_MODAL_CACHE_LOCK = Lock()

_LANGUAGE_MAP = {
    "md": "Markdown",
    "markdown": "Markdown",
    "py": "Python",
    "ts": "TypeScript",
    "tsx": "TypeScript",
    "js": "JavaScript",
    "jsx": "JavaScript",
    "json": "JSON",
    "yaml": "YAML",
    "yml": "YAML",
    "sh": "Shell",
    "css": "CSS",
    "scss": "CSS",
    "html": "HTML",
    "sql": "SQL",
    "txt": "Text",
    "rs": "Rust",
    "go": "Go",
    "java": "Java",
    "kt": "Kotlin",
    "swift": "Swift",
    "c": "C",
    "cpp": "C++",
}

_TEXT_EXTENSIONS = {
    "md",
    "markdown",
    "py",
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "yaml",
    "yml",
    "sh",
    "css",
    "scss",
    "html",
    "txt",
    "rs",
    "go",
    "java",
    "kt",
    "swift",
    "c",
    "cpp",
    "sql",
}

_README_BASENAMES = {"readme", "readme.md", "readme.markdown", "readme.txt"}
_MAX_PREVIEW_BYTES = 200_000


def _utc(value: dt.datetime | None) -> dt.datetime | None:
    if not value:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _get_project_groups(db: Session, project_ids: List[str]) -> Dict[str, List[ProjectGroup]]:
    if not project_ids:
        return {}
    result: Dict[str, List[ProjectGroup]] = {pid: [] for pid in project_ids}
    rows = db.execute(
        select(ProjectGroupMembership, ProjectGroup)
        .join(ProjectGroup, ProjectGroupMembership.group_id == ProjectGroup.id)
        .where(ProjectGroupMembership.project_id.in_(project_ids))
        .order_by(ProjectGroupMembership.project_id, ProjectGroupMembership.sort_order)
    ).all()
    for membership, group in rows:
        result.setdefault(membership.project_id, []).append(group)
    return result


def _to_group_reads(groups: List[ProjectGroup] | None) -> List[ProjectGroupRead]:
    if not groups:
        return []
    return [ProjectGroupRead.model_validate(g) for g in groups]


def _serialize_project_read(project: Project, groups: List[ProjectGroup] | None = None) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        tags=project.tags,
        status=project.status,
        color=project.color,
        is_starred=bool(project.is_starred),
        is_archived=bool(project.is_archived),
        created_at=project.created_at,
        updated_at=project.updated_at,
        groups=_to_group_reads(groups),
    )


def _apply_project_update(project: Project, body: ProjectUpdate, db: Session) -> ProjectRead:
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description or ""
    if body.status is not None:
        project.status = body.status
    if body.tags is not None:
        set_project_tags(db, project, body.tags)

    db.add(project)
    db.commit()
    db.refresh(project)

    group_map = _get_project_groups(db, [project.id])
    return _serialize_project_read(project, group_map.get(project.id))


def _update_project_internal(project_id: str, body: ProjectUpdate, db: Session) -> ProjectRead:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return _apply_project_update(project, body, db)


def _http_datetime(value: dt.datetime | None) -> str | None:
    if not value:
        return None
    dt_value = _utc(value)
    if not dt_value:
        return None
    return format_datetime(dt_value, usegmt=True)


def _apply_cache_headers(response: Response, signature: str, last_modified: dt.datetime | None) -> None:
    if signature:
        response.headers["ETag"] = hashlib.md5(signature.encode("utf-8")).hexdigest()
    lm = _http_datetime(last_modified)
    if lm:
        response.headers["Last-Modified"] = lm


def _normalize_path(path: str | None) -> str:
    if not path:
        return ""
    parts = [seg for seg in path.split("/") if seg]
    return "/".join(parts)


def _parent_path(path: str) -> str | None:
    parts = [seg for seg in path.split("/") if seg]
    if len(parts) <= 1:
        return None
    return "/".join(parts[:-1])


def _infer_language(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if ext in _LANGUAGE_MAP:
        return _LANGUAGE_MAP[ext]
    return ext.upper() if ext else "Other"


def _build_highlight(files: List[File]) -> ProjectCardHighlight | None:
    if not files:
        return None
    preferred = [f for f in files if f.path and f.path.lower().endswith("readme.md")]
    target = preferred[0] if preferred else files[0]
    snippet_source = (target.content_md or "").strip().replace("\n", " ")
    snippet = snippet_source[:200] + ("…" if len(snippet_source) > 200 else "")
    return ProjectCardHighlight(title=target.title, snippet=snippet or None, path=target.path)


def _build_sparkline(files: List[File], now: dt.datetime) -> list[int]:
    if not files:
        return []
    today = now.date()
    buckets = [0] * 7
    for f in files:
        if not f.updated_at:
            continue
        updated = _utc(f.updated_at)
        if not updated:
            continue
        delta = (today - updated.date()).days
        if 0 <= delta < 7:
            buckets[6 - delta] += 1
    return buckets


def _resolve_owners(db: Session) -> list[ProjectCardOwner]:
    user_row = db.get(User, "local")
    if user_row:
        return [ProjectCardOwner(id=user_row.id, name=user_row.name, avatar_url=user_row.avatar_url)]
    return [ProjectCardOwner(id="local", name="Local User", avatar_url=None)]


def _collect_directory_paths(db: Session, project_id: str, files: List[File]) -> set[str]:
    paths: set[str] = set()
    for f in files:
        parts = [seg for seg in f.path.split("/") if seg]
        for i in range(1, len(parts)):
            paths.add("/".join(parts[:i]))
    if int(settings.dirs_persist or 0) == 1:
        try:
            dir_rows = db.scalars(select(Directory).where(Directory.project_id == project_id)).all()
            for d in dir_rows:
                if d.path:
                    paths.add(_normalize_path(d.path))
        except Exception:
            # Directory table might not be migrated yet; ignore for modal fallback
            pass
    return paths


def _fetch_latest_commit(project: Project) -> dict | None:
    proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    git_dir = os.path.join(art_dir, ".git")
    if not os.path.isdir(git_dir):
        return None
    try:
        history = repo_history(art_dir, limit=1)
    except GitError:
        return None
    if not history:
        return None
    commit = history[0]
    if not commit.get("date"):
        commit["date"] = dt.datetime.now(tz=dt.timezone.utc)
    return commit


def _gather_modal_summary(db: Session, project: Project) -> Tuple[ProjectModalSummary, dt.datetime | None, str]:
    files: List[File] = (
        db.scalars(select(File).where(File.project_id == project.id)).all()
    )

    files.sort(key=lambda f: (_utc(f.updated_at) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)), reverse=True)
    files.sort(key=lambda f: (f.updated_at or dt.datetime.min.replace(tzinfo=dt.timezone.utc)), reverse=True)
    directory_paths = _collect_directory_paths(db, project.id, files)
    file_count = len(files)
    directory_count = len(directory_paths)

    lang_counts: Dict[str, int] = {}
    readme_path: Optional[str] = None
    latest_file: Optional[File] = files[0] if files else None
    for f in files:
        lang = _infer_language(f.path)
        lang_counts[lang] = lang_counts.get(lang, 0) + 1
        base = f.path.split("/")[-1].lower()
        if readme_path is None and base in _README_BASENAMES:
            readme_path = f.path

    language_mix = [
        ProjectCardLanguageStat(language=label, count=count)
        for label, count in sorted(lang_counts.items(), key=lambda item: (-item[1], item[0]))
    ]

    tag_details_map = get_project_tag_details(db, [project.id])
    tags = [
        ProjectCardTag(label=tag.label, slug=tag.slug, color=tag.color, usage_count=None)
        for tag in tag_details_map.get(project.id, [])
    ]

    group_map = _get_project_groups(db, [project.id])
    group_reads = _to_group_reads(group_map.get(project.id))

    owners = _resolve_owners(db)
    highlight = _build_highlight(files)

    quick_stats: list[ProjectModalQuickStat] = []

    latest_commit = _fetch_latest_commit(project)
    commit_ts = _utc(latest_commit.get("date")) if latest_commit else None
    if latest_commit:
        message = (latest_commit.get("message") or "").strip().splitlines()[0] if latest_commit.get("message") else "Commit"
        short_sha = (latest_commit.get("sha") or "")[:7]
        display = message[:80] + ("…" if len(message) > 80 else "")
        quick_stats.append(
            ProjectModalQuickStat(
                id="last_commit",
                label="Last commit",
                value=display or short_sha or "Commit",
                subvalue=short_sha or None,
                timestamp=commit_ts,
                metadata={
                    "sha": latest_commit.get("sha"),
                    "message": latest_commit.get("message"),
                },
            )
        )

    if latest_file and latest_file.updated_at:
        quick_stats.append(
            ProjectModalQuickStat(
                id="last_edit",
                label="Last edited",
                value=latest_file.title or latest_file.path,
                subvalue=latest_file.path,
                timestamp=_utc(latest_file.updated_at),
                metadata={"file_id": latest_file.id, "path": latest_file.path},
            )
        )

    quick_stats.append(
        ProjectModalQuickStat(
            id="files",
            label="Files",
            value=str(file_count),
            subvalue=f"{directory_count} folders",
            metadata={"directory_count": directory_count},
        )
    )

    last_modified_candidates = [
        _utc(project.updated_at),
        _utc(latest_file.updated_at) if latest_file and latest_file.updated_at else None,
        commit_ts,
    ]
    last_modified = max([val for val in last_modified_candidates if val], default=_utc(project.updated_at))

    summary = ProjectModalSummary(
        id=project.id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        status=project.status,
        updated_at=_utc(project.updated_at),
        is_starred=bool(project.is_starred),
        tags=tags,
        owners=owners,
        file_count=file_count,
        directory_count=directory_count,
        language_mix=language_mix,
        readme_path=readme_path,
        highlight=highlight,
        quick_stats=quick_stats,
        groups=group_reads,
    )

    signature_parts = [
        project.id,
        summary.updated_at.isoformat() if summary.updated_at else "",
        str(summary.is_starred),
        str(file_count),
        str(directory_count),
        commit_ts.isoformat() if commit_ts else "",
        _utc(latest_file.updated_at).isoformat() if latest_file and latest_file.updated_at else "",
    ]
    signature = "|".join(signature_parts)
    return summary, last_modified, signature


def _compute_tree_nodes(
    db: Session,
    project: Project,
    path: str | None,
    include_dirs: bool,
    query: str | None,
) -> Tuple[list[ProjectTreeNode], dt.datetime | None, str]:
    normalized_path = _normalize_path(path)
    query_value = (query or "").strip().lower()

    files: List[File] = (
        db.scalars(select(File).where(File.project_id == project.id)).all()
    )

    tag_slugs: set[str] = set()
    for file in files:
        for raw_tag in file.tags or []:
            if not raw_tag:
                continue
            slug = slugify(raw_tag)
            if slug:
                tag_slugs.add(slug)

    tag_lookup: dict[str, Tag] = {}
    if tag_slugs:
        tag_rows = db.scalars(select(Tag).where(Tag.slug.in_(tag_slugs))).all()
        tag_lookup = {tag.slug: tag for tag in tag_rows}

    directory_paths = _collect_directory_paths(db, project.id, files)

    latest_file = files[0] if files else None
    latest_file_updated = _utc(latest_file.updated_at) if latest_file and latest_file.updated_at else None

    children_counts: Dict[str, int] = {}

    def _increment_parent(parent: str | None) -> None:
        key = parent or ""
        children_counts[key] = children_counts.get(key, 0) + 1

    for dir_path in directory_paths:
        parent = _parent_path(dir_path)
        _increment_parent(parent)

    for f in files:
        parent = _parent_path(f.path)
        _increment_parent(parent)

    if "" not in children_counts:
        children_counts[""] = children_counts.get("", 0)

    nodes: list[ProjectTreeNode] = []
    target_parent_key = normalized_path or ""

    # Directories first
    for dir_path in sorted(directory_paths):
        parent = _parent_path(dir_path)
        parent_key = parent or ""
        if query_value:
            if query_value not in dir_path.lower():
                continue
        elif parent_key != target_parent_key:
            continue
        parts = [seg for seg in dir_path.split("/") if seg]
        depth = len(parts)
        node = ProjectTreeNode(
            type="dir",
            name=parts[-1] if parts else dir_path,
            path=dir_path,
            depth=depth,
            parent_path=parent,
            has_children=children_counts.get(dir_path, 0) > 0,
            children_count=children_counts.get(dir_path, 0),
        )
        nodes.append(node)

    for f in files:
        haystack = f"{f.path.lower()} {f.title.lower() if f.title else ''}"
        parent = _parent_path(f.path)
        parent_key = parent or ""
        if query_value:
            if query_value not in haystack:
                continue
        elif parent_key != target_parent_key:
            continue
        parts = [seg for seg in f.path.split("/") if seg]
        depth = len(parts)
        ext = (f.path.rsplit(".", 1)[-1].lower() if "." in f.path else "")
        size_bytes = len((f.content_md or "").encode("utf-8"))
        preview_eligible = (ext in _TEXT_EXTENSIONS) and size_bytes <= _MAX_PREVIEW_BYTES
        badges: list[str] = []
        if parts and parts[-1].lower() in _README_BASENAMES:
            badges.append("readme")
        mime_type, _ = mimetypes.guess_type(f.path)
        raw_tags = f.tags or []
        tag_details: list[TagSummary] = []
        for raw_tag in raw_tags:
            if not raw_tag:
                continue
            slug = slugify(raw_tag) or raw_tag
            tag = tag_lookup.get(slug)
            if tag:
                tag_details.append(
                    TagSummary(
                        slug=tag.slug,
                        label=tag.label,
                        color=tag.color,
                        emoji=getattr(tag, "emoji", None),
                    )
                )
            else:
                tag_details.append(
                    TagSummary(
                        slug=slug,
                        label=str(raw_tag),
                        color=None,
                        emoji=None,
                    )
                )

        node = ProjectTreeNode(
            type="file",
            name=parts[-1] if parts else f.title,
            path=f.path,
            depth=depth,
            parent_path=parent,
            file_id=f.id,
            updated_at=_utc(f.updated_at),
            size=size_bytes,
            preview_eligible=preview_eligible,
            badges=badges,
            language=_infer_language(f.path),
            extension=ext or None,
            icon_hint=(ext or None) or mime_type,
            tags=tag_details,
        )
        nodes.append(node)

    # If include_dirs is False, remove directories which have no backing files unless they were derived from file parents
    if not include_dirs and not query_value:
        nodes = [n for n in nodes if n.type == "file" or children_counts.get(n.path, 0) > 0]

    nodes.sort(key=lambda n: (0 if n.type == "dir" else 1, n.path.lower()))

    last_modified_candidates = [
        _utc(project.updated_at),
        latest_file_updated,
    ]
    last_modified = max([val for val in last_modified_candidates if val], default=_utc(project.updated_at))

    signature_parts = [
        project.id,
        target_parent_key,
        query_value,
        str(len(nodes)),
        last_modified.isoformat() if last_modified else "",
    ]
    signature = "|".join(signature_parts)
    return nodes, last_modified, signature


def _format_event_message(event_type: str) -> str:
    mapping = {
        "bundle.started": "Bundle export started",
        "bundle.completed": "Bundle export completed",
        "bundle.failed": "Bundle export failed",
        "bundle.branch_pushed": "Bundle branch pushed",
        "bundle.pr_opened": "Bundle PR opened",
        "commit.started": "Commit started",
        "commit.completed": "Commit completed",
        "commit.failed": "Commit failed",
    }
    if event_type in mapping:
        return mapping[event_type]
    return event_type.replace(".", " ").title()


def _compute_activity_entries(
    db: Session,
    project: Project,
    type_filter: set[str],
    limit: int,
) -> Tuple[list[ProjectActivityEntry], list[str], dt.datetime | None, str]:
    entries: list[ProjectActivityEntry] = []
    sources: set[str] = set()

    include_commits = not type_filter or "commit" in type_filter
    include_files = not type_filter or "file_change" in type_filter or "file" in type_filter
    include_events = not type_filter or "job" in type_filter or "event" in type_filter

    if include_commits:
        commits: list[dict] = []
        proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
        art_dir = os.path.join(proj_dir, "artifacts")
        if os.path.isdir(os.path.join(art_dir, ".git")):
            try:
                commits = repo_history(art_dir, limit=max(20, limit * 2))
            except GitError:
                commits = []
        for commit in commits:
            timestamp = _utc(commit.get("date")) or dt.datetime.now(tz=dt.timezone.utc)
            message = (commit.get("message") or "").strip().splitlines()[0] if commit.get("message") else "Commit"
            short_sha = (commit.get("sha") or "")[:7]
            entries.append(
                ProjectActivityEntry(
                    id=f"commit:{commit.get('sha')}",
                    type="commit",
                    message=message,
                    timestamp=timestamp,
                    actor=commit.get("author"),
                    context={
                        "sha": commit.get("sha"),
                        "short_sha": short_sha,
                        "message": commit.get("message"),
                    },
                )
            )
        if commits:
            sources.add("commits")

    if include_files:
        file_rows: List[File] = (
            db.scalars(
                select(File)
                .where(File.project_id == project.id)
                .order_by(File.updated_at.desc())
                .limit(max(40, limit * 3))
            ).all()
        )
        for f in file_rows:
            if not f.updated_at:
                continue
            timestamp = _utc(f.updated_at) or dt.datetime.now(tz=dt.timezone.utc)
            entries.append(
                ProjectActivityEntry(
                    id=f"file:{f.id}:{timestamp.isoformat()}",
                    type="file_change",
                    message=f"{f.title or f.path} updated",
                    timestamp=timestamp,
                    actor=None,
                    context={"file_id": f.id, "path": f.path},
                )
            )
        if file_rows:
            sources.add("files")

    if include_events:
        event_rows: List[Event] = (
            db.scalars(
                select(Event)
                .where(Event.project_id == project.id)
                .order_by(Event.created_at.desc())
                .limit(max(40, limit * 3))
            ).all()
        )
        for ev in event_rows:
            timestamp = _utc(ev.created_at) or dt.datetime.now(tz=dt.timezone.utc)
            entry_type = "job" if ev.type.startswith("bundle.") else "event"
            sources.add("jobs" if entry_type == "job" else "events")
            entries.append(
                ProjectActivityEntry(
                    id=f"event:{ev.id}",
                    type=entry_type,
                    message=_format_event_message(ev.type),
                    timestamp=timestamp,
                    actor=None,
                    context={"type": ev.type, "payload": ev.payload},
                )
            )

    entries.sort(key=lambda e: e.timestamp or dt.datetime.min.replace(tzinfo=dt.timezone.utc), reverse=True)

    last_modified = entries[0].timestamp if entries else _utc(project.updated_at)

    type_key = ",".join(sorted(type_filter)) if type_filter else "all"
    signature_parts = [
        project.id,
        type_key,
        last_modified.isoformat() if last_modified else "",
        str(len(entries)),
    ]
    signature = "|".join(signature_parts)
    return entries, sorted(sources), last_modified, signature


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    slug = slugify(body.name)
    # Uniqueness checks
    exists = db.scalar(select(Project).where(Project.slug == slug))
    if exists:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "Project exists"})
    p = Project(name=body.name, slug=slug, description=body.description or "", status=body.status)
    db.add(p)
    db.flush()
    set_project_tags(db, p, body.tags)
    db.commit()
    db.refresh(p)
    # Create on-disk layout
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    os.makedirs(os.path.join(proj_dir, "files"), exist_ok=True)
    os.makedirs(os.path.join(proj_dir, "bundles"), exist_ok=True)
    proj_json = {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "tags": p.tags,
        "status": p.status,
    }
    with open(os.path.join(proj_dir, "project.json"), "w") as f:
        json.dump(proj_json, f, indent=2)
    return p


@router.get("", response_model=ProjectListResponse)
def list_projects(
    view: str | None = Query(default="all"),
    tags: list[str] = Query(default_factory=list, alias="tags[]"),
    language: list[str] = Query(default_factory=list, alias="language[]"),
    owner: str | None = None,
    updated_after: str | None = None,
    updated_before: str | None = None,
    sort: str | None = "-updated",
    limit: int = 20,
    cursor: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        offset = int(cursor) if cursor else 0
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail={"code": "BAD_CURSOR", "message": "Cursor must be integer"}) from exc

    limit = max(1, min(limit, 50))
    normalized_view = (view or "all").lower()

    rows: list[Project] = db.scalars(select(Project)).all()

    # Filter by archive/star view state
    filtered: list[Project] = []
    now = dt.datetime.now(tz=dt.timezone.utc)
    recent_cutoff = now - dt.timedelta(days=30)

    def matches_view(project: Project) -> bool:
        if normalized_view == "archived":
            return bool(project.is_archived)
        archived_block = project.is_archived and normalized_view not in {"archived"}
        if archived_block:
            return False
        if normalized_view == "starred":
            return bool(project.is_starred)
        if normalized_view in {"recent", "recently_updated"}:
            return project.updated_at and project.updated_at >= recent_cutoff
        return True

    # Parse updated_after/before (ISO8601)
    def parse_dt(value: str | None) -> dt.datetime | None:
        if not value:
            return None
        try:
            return dt.datetime.fromisoformat(value)
        except ValueError:
            raise HTTPException(status_code=400, detail={"code": "BAD_DATETIME", "message": "Invalid datetime"})

    after_dt = parse_dt(updated_after)
    before_dt = parse_dt(updated_before)

    for project in rows:
        if not matches_view(project):
            continue
        if tags:
            requested = {slugify(t) for t in tags}
            project_tag_slugs = {t.slug for t in project.tag_entities}
            project_tag_labels = {slugify(t.label) for t in project.tag_entities}
            if not requested.issubset(project_tag_slugs.union(project_tag_labels)):
                continue
        if after_dt and project.updated_at and project.updated_at < after_dt:
            continue
        if before_dt and project.updated_at and project.updated_at > before_dt:
            continue
        filtered.append(project)

    if owner:
        # Single-user instance: only accept owner == "me"/"local"/"default"
        normalized_owner = owner.lower()
        if normalized_owner not in {"me", "local", "default"}:
            filtered = []

    project_ids = [p.id for p in filtered]
    group_map = _get_project_groups(db, project_ids)
    files_by_project: Dict[str, list[File]] = {pid: [] for pid in project_ids}
    if project_ids:
        file_rows = db.scalars(select(File).where(File.project_id.in_(project_ids))).all()
        for f in file_rows:
            files_by_project.setdefault(f.project_id, []).append(f)

    # Build derived metrics for each project
    derived: Dict[str, dict] = {}
    for project in filtered:
        pfiles = files_by_project.get(project.id, [])
        lang_counts: Dict[str, int] = {}
        for f in pfiles:
            lang = _infer_language(f.path)
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
        lang_stats = [ProjectCardLanguageStat(language=k, count=v) for k, v in sorted(lang_counts.items(), key=lambda item: (-item[1], item[0]))]
        derived[project.id] = {
            "file_count": len(pfiles),
            "language_mix": lang_stats,
            "highlight": _build_highlight(pfiles),
            "sparkline": _build_sparkline(pfiles, now),
            "languages": set(lang_counts.keys()),
        }

    if language:
        lang_targets = {lang.lower() for lang in language}
        filtered = [
            p
            for p in filtered
            if derived.get(p.id, {}).get("languages")
            and any(lang.lower() in lang_targets for lang in derived[p.id]["languages"])
        ]

    # Sorting
    def sort_key(project: Project):
        if sort in {"updated", "+updated"}:
            return project.updated_at or dt.datetime.min.replace(tzinfo=dt.timezone.utc)
        if sort in {"name", "+name"}:
            return project.name.lower()
        if sort in {"-name"}:
            return project.name.lower()
        # Default: -updated
        return project.updated_at or dt.datetime.min.replace(tzinfo=dt.timezone.utc)

    reverse = True
    if sort in {"name", "+name"}:
        reverse = False
    elif sort in {"-name"}:
        reverse = True
    elif sort in {"updated", "+updated"}:
        reverse = False
    elif sort in {"-updated", None, ""}:
        reverse = True
    filtered.sort(key=sort_key, reverse=reverse)

    total = len(filtered)
    page_items = filtered[offset : offset + limit]
    next_cursor = str(offset + limit) if offset + limit < total else None

    # Owners — single local user fallback
    owners = _resolve_owners(db)

    project_tag_map = get_project_tag_details(db, [p.id for p in filtered])

    cards: list[ProjectCardRead] = []
    for project in page_items:
        lang_stats = derived.get(project.id, {}).get("language_mix", [])
        highlight = derived.get(project.id, {}).get("highlight")
        sparkline = derived.get(project.id, {}).get("sparkline", [])

        tags_details = []
        for tag in project_tag_map.get(project.id, []):
            tags_details.append(
                ProjectCardTag(
                    label=tag.label,
                    slug=tag.slug,
                    color=tag.color,
                    usage_count=None,
                )
            )

        group_reads = _to_group_reads(group_map.get(project.id))

        card = ProjectCardRead(
            id=project.id,
            name=project.name,
            slug=project.slug,
            description=project.description,
            status=project.status,
            color=project.color,
            tags=[tag.slug for tag in project_tag_map.get(project.id, [])],
            tag_details=tags_details,
            is_starred=bool(project.is_starred),
            is_archived=bool(project.is_archived),
            created_at=project.created_at,
            updated_at=project.updated_at,
            file_count=derived.get(project.id, {}).get("file_count", 0),
            language_mix=lang_stats,
            owners=owners,
            highlight=highlight,
            activity_sparkline=sparkline,
            groups=group_reads,
        )
        cards.append(card)

    return ProjectListResponse(
        projects=cards,
        next_cursor=next_cursor,
        total=total,
        limit=limit,
        view=normalized_view,
        filters={
            "tags": tags,
            "language": language,
            "owner": owner,
            "updated_after": updated_after,
            "updated_before": updated_before,
        },
    )


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})
    group_map = _get_project_groups(db, [p.id])
    return _serialize_project_read(p, group_map.get(p.id))


@router.get("/{project_id}/modal", response_model=ProjectModalSummary)
def get_project_modal(project_id: str, response: Response, db: Session = Depends(get_db)):
    if int(settings.project_modal or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Project modal disabled"})
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})

    cached_entry = None
    with _MODAL_CACHE_LOCK:
        cached_entry = _MODAL_CACHE.get(project_id)

    summary, last_modified, signature = _gather_modal_summary(db, project)
    if cached_entry and cached_entry[0] == signature:
        summary = cached_entry[1]
        last_modified = cached_entry[2]
    else:
        with _MODAL_CACHE_LOCK:
            _MODAL_CACHE[project_id] = (signature, summary, last_modified)

    _apply_cache_headers(response, signature, last_modified)
    return summary


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: str, body: ProjectCreate, db: Session = Depends(get_db)):
    payload = ProjectUpdate(
        name=body.name,
        description=body.description,
        status=body.status,
        tags=body.tags,
    )
    return _update_project_internal(project_id, payload, db)


@router.patch("/{project_id}", response_model=ProjectRead)
def patch_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)):
    if body.name is None and body.description is None and body.status is None and body.tags is None:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
        group_map = _get_project_groups(db, [project.id])
        return _serialize_project_read(project, group_map.get(project.id))
    return _update_project_internal(project_id, body, db)


@router.post("/{project_id}/star", status_code=204)
def star_project(project_id: str, db: Session = Depends(get_db)) -> Response:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    if not project.is_starred:
        project.is_starred = True
        db.add(project)
        db.commit()
    return Response(status_code=204)


@router.delete("/{project_id}/star", status_code=204)
def unstar_project(project_id: str, db: Session = Depends(get_db)) -> Response:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    if project.is_starred:
        project.is_starred = False
        db.add(project)
        db.commit()
    return Response(status_code=204)


@router.post("/{project_id}/archive", status_code=204)
def archive_project(project_id: str, db: Session = Depends(get_db)) -> Response:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    if not project.is_archived:
        project.is_archived = True
        db.add(project)
        db.commit()
    return Response(status_code=204)


@router.delete("/{project_id}/archive", status_code=204)
def unarchive_project(project_id: str, db: Session = Depends(get_db)) -> Response:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    if project.is_archived:
        project.is_archived = False
        db.add(project)
        db.commit()
    return Response(status_code=204)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        return
    # Delete related rows first to avoid FK constraint errors
    # Files (and search index)
    file_ids = [f.id for f in db.scalars(select(File).where(File.project_id == project_id)).all()]
    for fid in file_ids:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM search_index WHERE file_id = :fid"), {"fid": fid})
    db.query(File).filter(File.project_id == project_id).delete(synchronize_session=False)

    # Artifact repos
    db.query(ArtifactRepo).filter(ArtifactRepo.project_id == project_id).delete(synchronize_session=False)

    # Bundles (if any are persisted in future)
    try:
        db.query(Bundle).filter(Bundle.project_id == project_id).delete(synchronize_session=False)
    except Exception:
        # Table may be unused; ignore
        pass

    # Remove on-disk project directory
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    try:
        shutil.rmtree(proj_dir)
    except FileNotFoundError:
        pass

    # Finally delete the project itself
    db.delete(p)
    db.commit()
    return


@router.get("/{project_id}/tree", response_model=ProjectTreeResponse)
def get_project_tree(
    project_id: str,
    response: Response,
    path: str | None = Query(default=None),
    include_dirs: int | None = Query(default=1, description="Include persisted empty directories"),
    limit: int = Query(default=200, ge=1, le=500),
    cursor: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if int(settings.project_modal or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Project modal disabled"})
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})

    try:
        offset = int(cursor) if cursor else 0
        if offset < 0:
            raise ValueError
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "BAD_CURSOR", "message": "Cursor must be non-negative integer"}) from exc

    include_flag = bool(int(include_dirs or 0))

    nodes, last_modified, signature = _compute_tree_nodes(db, project, path, include_flag, q)
    total = len(nodes)
    items = nodes[offset : offset + limit]
    next_cursor = str(offset + limit) if offset + limit < total else None

    payload = ProjectTreeResponse(items=items, next_cursor=next_cursor, total=total)
    _apply_cache_headers(response, signature, last_modified)
    return payload


@router.get("/{project_id}/activity", response_model=ProjectActivityResponse)
def get_project_activity(
    project_id: str,
    response: Response,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
    types: list[str] = Query(default_factory=list, alias="types[]"),
    db: Session = Depends(get_db),
):
    if int(settings.project_modal or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Project modal disabled"})
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project not found"})

    try:
        offset = int(cursor) if cursor else 0
        if offset < 0:
            raise ValueError
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "BAD_CURSOR", "message": "Cursor must be non-negative integer"}) from exc

    type_filter = {t.strip().lower() for t in types if t.strip()}
    entries, sources, last_modified, signature = _compute_activity_entries(db, project, type_filter, limit)

    total = len(entries)
    items = entries[offset : offset + limit]
    next_cursor = str(offset + limit) if offset + limit < total else None

    payload = ProjectActivityResponse(items=items, next_cursor=next_cursor, sources=sources)
    _apply_cache_headers(response, signature, last_modified)
    return payload


@router.get("/{project_id}/files", response_model=list[FileRead])
def list_project_files(project_id: str, db: Session = Depends(get_db)):
    try:
        p = db.get(Project, project_id)
        if not p:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
        files = p.files
        tag_slugs: set[str] = set()
        for f in files:
            for label in f.tags or []:
                slug = slugify(label)
                if slug:
                    tag_slugs.add(slug)
        tag_lookup: dict[str, Tag] = {}
        if tag_slugs:
            tag_rows = db.scalars(select(Tag).where(Tag.slug.in_(tag_slugs))).all()
            tag_lookup = {row.slug: row for row in tag_rows}

        payload: list[FileRead] = []
        for f in files:
            front_matter = f.front_matter or {}
            tags = list(f.tags or [])
            description_value = front_matter.get('description') if isinstance(front_matter.get('description'), str) else None
            if description_value:
                description_value = description_value.strip() or None
            icon_hint = front_matter.get('icon') if isinstance(front_matter.get('icon'), str) else None
            if not icon_hint and f.path and '.' in f.path:
                icon_hint = f.path.rsplit('.', 1)[-1].lower()
            _, body = extract_front_matter(f.content_md or '')
            summary_text = summarize_markdown(body)
            if description_value and len(description_value) > 180:
                summary_value = description_value[:179].rstrip() + '…'
            else:
                summary_value = description_value or summary_text
            payload.append(
                FileRead(
                    id=f.id,
                    project_id=f.project_id,
                    path=f.path,
                    title=f.title,
                    content_md=f.content_md,
                    rendered_html=f.rendered_html,
                    tags=tags,
                    front_matter=front_matter,
                    description=description_value,
                    links=list(front_matter.get('links') or []),
                    icon_hint=icon_hint,
                    tag_details=build_tag_details(tags, tag_lookup),
                    summary=summary_value,
                    updated_at=f.updated_at,
                )
            )

        return payload
    except Exception as e:
        import traceback
        print("[ERROR] Exception in list_project_files:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": str(e)})


@router.get("/{project_id}/files/raw")
def get_project_file_asset(project_id: str, path: str = Query(..., description="File path within the project"), db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})

    segments: list[str] = []
    for seg in path.split('/'):
        if not seg or seg == '.':
            continue
        if seg == '..':
            if segments:
                segments.pop()
            continue
        segments.append(seg)
    normalized = '/'.join(segments)
    project_base = os.path.join(settings.data_dir, 'projects', project.slug)

    try:
        abs_path = safe_join(project_base, 'files', normalized)
    except Exception:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})

    if abs_path and os.path.isfile(abs_path):
        mime_type, _ = mimetypes.guess_type(abs_path)
        resp = FileResponse(abs_path, media_type=mime_type or 'application/octet-stream', filename=os.path.basename(abs_path))
        resp.headers["Content-Disposition"] = f"inline; filename=\"{os.path.basename(abs_path)}\""
        return resp

    file_row = db.scalar(select(File).where(File.project_id == project_id, File.path == normalized))
    if file_row and file_row.content_md is not None:
        media_type = 'text/plain; charset=utf-8'
        if file_row.path.lower().endswith(('.md', '.markdown', '.html')):
            media_type = 'text/html; charset=utf-8'
        return Response(content=file_row.content_md, media_type=media_type)

    raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})


@router.get("/{project_id}/files/tree")
def get_project_files_tree(
    project_id: str,
    include_empty_dirs: int | None = 0,
    depth: int | None = None,
    db: Session = Depends(get_db),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    include_empty = 1 if int(include_empty_dirs or 0) == 1 and int(settings.dirs_persist or 0) == 1 else 0
    # Build tree from file paths and (optionally) persisted empty directories
    files = db.scalars(select(File).where(File.project_id == project_id)).all()
    root: dict = {"name": "", "path": "", "type": "dir", "children": {}}
    # Insert file-derived paths
    for f in files:
        parts = [seg for seg in f.path.split("/") if seg]
        cur = root
        acc = []
        for i, seg in enumerate(parts):
            acc.append(seg)
            is_last = i == len(parts) - 1
            if is_last:
                # file node
                if "children" not in cur:
                    cur["children"] = {}
                cur["children"].setdefault(seg, {
                    "name": seg,
                    "path": "/".join(acc),
                    "type": "file",
                    "file_id": f.id,
                    "title": f.title,
                })
            else:
                if "children" not in cur:
                    cur["children"] = {}
                if seg not in cur["children"]:
                    cur["children"][seg] = {"name": seg, "path": "/".join(acc), "type": "dir", "children": {}}
                cur = cur["children"][seg]

    # Optionally include persisted empty directories
    try:
        from ..models import Directory  # local import to avoid cycles

        if include_empty == 1:
            dirs = db.scalars(select(Directory).where(Directory.project_id == project_id)).all()
            for d in dirs:
                parts = [seg for seg in d.path.split("/") if seg]
                cur = root
                acc = []
                for i, seg in enumerate(parts):
                    acc.append(seg)
                    if "children" not in cur:
                        cur["children"] = {}
                    if seg not in cur["children"]:
                        cur["children"][seg] = {"name": seg, "path": "/".join(acc), "type": "dir", "children": {}}
                    cur = cur["children"][seg]
    except Exception:
        # If Directory table missing, ignore
        pass

    def to_list(node: dict) -> list:
        if "children" not in node:
            return []
        items = []
        for name, child in node["children"].items():
            if child["type"] == "dir":
                child_out = child.copy()
                child_out["children"] = to_list(child)
                items.append(child_out)
            else:
                items.append(child)
        # sort: dirs first by name, then files by name
        items.sort(key=lambda x: (0 if x["type"] == "dir" else 1, x["name"].lower()))
        return items

    items = to_list(root)

    # Depth limiting: depth=1 returns only top-level items
    if depth and isinstance(depth, int) and depth > 0:
        def prune(nodes: list[dict], current_depth: int) -> list[dict]:
            out: list[dict] = []
            for n in nodes:
                if n.get("type") == "dir":
                    nn = {k: v for k, v in n.items() if k != "children"}
                    if current_depth < depth and n.get("children"):
                        nn["children"] = prune(n.get("children", []), current_depth + 1)
                    else:
                        nn["children"] = []
                    out.append(nn)
                else:
                    out.append(n)
            return out

        items = prune(items, 1)

    return items
