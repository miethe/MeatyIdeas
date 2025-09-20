from __future__ import annotations

import hashlib
import json
import os
import datetime as dt
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import Project, File, ArtifactRepo, Bundle, User
from ..schemas import (
    ProjectCreate,
    ProjectRead,
    ProjectCardRead,
    ProjectCardLanguageStat,
    ProjectCardOwner,
    ProjectCardTag,
    ProjectCardHighlight,
    ProjectListResponse,
    FileRead,
)
from ..settings import settings
from ..utils import slugify
import shutil


router = APIRouter(prefix="/projects", tags=["projects"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    slug = slugify(body.name)
    # Uniqueness checks
    exists = db.scalar(select(Project).where(Project.slug == slug))
    if exists:
        raise HTTPException(status_code=409, detail={"code": "DUPLICATE", "message": "Project exists"})
    p = Project(name=body.name, slug=slug, description=body.description or "", tags=body.tags, status=body.status)
    db.add(p)
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
            project_tags = set([t.lower() for t in project.tags or []])
            if not all(t.lower() in project_tags for t in tags):
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
    files_by_project: Dict[str, list[File]] = {pid: [] for pid in project_ids}
    if project_ids:
        file_rows = db.scalars(select(File).where(File.project_id.in_(project_ids))).all()
        for f in file_rows:
            files_by_project.setdefault(f.project_id, []).append(f)

    def detect_language(path: str) -> str:
        ext = (path.rsplit(".", 1)[-1] if "." in path else "").lower()
        if ext in {"md", "markdown"}:
            return "Markdown"
        if ext in {"py"}:
            return "Python"
        if ext in {"ts", "tsx"}:
            return "TypeScript"
        if ext in {"js", "jsx"}:
            return "JavaScript"
        if ext in {"json"}:
            return "JSON"
        if ext in {"yaml", "yml"}:
            return "YAML"
        if ext in {"sh"}:
            return "Shell"
        if ext in {"css", "scss"}:
            return "CSS"
        if ext in {"html"}:
            return "HTML"
        return ext.upper() if ext else "Other"

    def build_highlight(project_files: list[File]) -> ProjectCardHighlight | None:
        if not project_files:
            return None
        # Prefer README-like files
        preferred = [f for f in project_files if f.path.lower().endswith("readme.md")]
        target = preferred[0] if preferred else project_files[0]
        snippet = (target.content_md or "").strip().replace("\n", " ")
        snippet = snippet[:200] + ("…" if len(snippet) > 200 else "")
        return ProjectCardHighlight(title=target.title, snippet=snippet or None, path=target.path)

    def build_sparkline(project_files: list[File]) -> list[int]:
        if not project_files:
            return []
        today = now.date()
        buckets = [0] * 7
        for f in project_files:
            if not f.updated_at:
                continue
            delta = (today - f.updated_at.date()).days
            if 0 <= delta < 7:
                buckets[6 - delta] += 1
        return buckets

    # Build derived metrics for each project
    derived: Dict[str, dict] = {}
    for project in filtered:
        pfiles = files_by_project.get(project.id, [])
        lang_counts: Dict[str, int] = {}
        for f in pfiles:
            lang = detect_language(f.path)
            lang_counts[lang] = lang_counts.get(lang, 0) + 1
        lang_stats = [ProjectCardLanguageStat(language=k, count=v) for k, v in sorted(lang_counts.items(), key=lambda item: (-item[1], item[0]))]
        derived[project.id] = {
            "file_count": len(pfiles),
            "language_mix": lang_stats,
            "highlight": build_highlight(pfiles),
            "sparkline": build_sparkline(pfiles),
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
    owners: list[ProjectCardOwner] = []
    user_row = db.get(User, "local")
    if user_row:
        owners = [ProjectCardOwner(id=user_row.id, name=user_row.name, avatar_url=user_row.avatar_url)]
    else:
        owners = [ProjectCardOwner(id="local", name="Local User", avatar_url=None)]

    def tag_hex(tag: str) -> str | None:
        if not tag:
            return None
        digest = hashlib.md5(tag.encode()).hexdigest()
        return f"#{digest[:6]}"

    cards: list[ProjectCardRead] = []
    for project in page_items:
        lang_stats = derived.get(project.id, {}).get("language_mix", [])
        highlight = derived.get(project.id, {}).get("highlight")
        sparkline = derived.get(project.id, {}).get("sparkline", [])

        tags_details = [
            ProjectCardTag(label=t, slug=t, color=tag_hex(t), usage_count=None)
            for t in (project.tags or [])
        ]

        card = ProjectCardRead(
            id=project.id,
            name=project.name,
            slug=project.slug,
            description=project.description,
            status=project.status,
            color=project.color,
            tags=project.tags or [],
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
    return p


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: str, body: ProjectCreate, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    p.name = body.name
    p.description = body.description or ""
    p.tags = body.tags
    p.status = body.status
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


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


@router.get("/{project_id}/files", response_model=list[FileRead])
def list_project_files(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return p.files


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
