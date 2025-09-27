from __future__ import annotations

import os
import shutil
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..events_pub import publish_event
from ..models import Directory, File, Project
from ..schemas import (
    DirectoryCreate,
    DirectoryRead,
    DirectoryMoveRequest,
    DirectoryMoveDryRunResult,
    DirectoryMoveApplyResult,
    DirectoryChange,
    FileMovePreview,
    DirectoryDeleteRequest,
    DirectoryDeleteResult,
)
from ..settings import settings
from ..utils import safe_join
from ..search import index_file
from ..app_logging import get_logger


def require_dirs_enabled():
    if int(settings.dirs_persist or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Directories disabled"})


router = APIRouter(
    prefix="/projects",
    tags=["directories"],
    dependencies=[Depends(require_dirs_enabled)],
)

logger = get_logger(component="directories.api")


def _log_dir_event(action: str, project_id: str, start: float, level: str = "info", **extra: object) -> None:
    duration_ms = int((time.perf_counter() - start) * 1000)
    payload: dict[str, object] = {"project_id": project_id, "duration_ms": duration_ms}
    payload.update(extra)
    getattr(logger, level, logger.info)(action, **payload)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _validate_path(path: str) -> None:
    if not path or path.strip("/") == "":
        raise HTTPException(status_code=400, detail={"code": "BAD_PATH", "message": "Path required"})
    if any(seg in path for seg in ["..", "\\", ":"]):
        raise HTTPException(status_code=400, detail={"code": "BAD_PATH", "message": "Invalid path"})


@router.post("/{project_id}/dirs", response_model=DirectoryRead, status_code=201)
def create_dir(project_id: str, body: DirectoryCreate, db: Session = Depends(get_db)):
    _validate_path(body.path)
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    start = time.perf_counter()
    norm = "/".join([seg for seg in body.path.split("/") if seg])
    name = norm.split("/")[-1]
    # Upsert: unique per (project, path)
    existing = db.scalars(select(Directory).where(Directory.project_id == project_id, Directory.path == norm)).first()
    if existing:
        _log_dir_event("dir.create.noop", project_id, start, path=norm)
        return existing
    d = Directory(project_id=project_id, path=norm, name=name)
    db.add(d)
    db.commit()
    db.refresh(d)
    # Ensure on-disk directory exists
    proj_dir = os.path.join(settings.data_dir, "projects", proj.slug)
    abs_dir = safe_join(proj_dir, "files", norm)
    os.makedirs(abs_dir, exist_ok=True)
    try:
        publish_event(project_id, "dir.created", {"path": norm})
    except Exception:
        pass
    _log_dir_event("dir.create", project_id, start, path=norm)
    return d


@router.patch("/{project_id}/dirs", response_model=DirectoryMoveApplyResult | DirectoryMoveDryRunResult)
def move_dir(project_id: str, body: DirectoryMoveRequest, db: Session = Depends(get_db)):
    _validate_path(body.old_path)
    _validate_path(body.new_path)
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    start = time.perf_counter()
    old_norm = "/".join([seg for seg in body.old_path.split("/") if seg])
    new_norm = "/".join([seg for seg in body.new_path.split("/") if seg])
    if old_norm == new_norm:
        return DirectoryMoveDryRunResult(applied=False, dir_changes=[], file_moves=[], dirs_count=0, files_count=0)

    # Collect affected directories
    all_dirs: list[Directory] = db.scalars(
        select(Directory).where(Directory.project_id == project_id)
    ).all()
    affected_dirs: list[Directory] = [d for d in all_dirs if d.path == old_norm or d.path.startswith(old_norm + "/")]
    dir_changes: list[DirectoryChange] = []
    for d in affected_dirs:
        suffix = d.path[len(old_norm) :]
        if suffix.startswith("/"):
            suffix = suffix[1:]
        new_path = new_norm if not suffix else f"{new_norm}/{suffix}"
        dir_changes.append(DirectoryChange(old_path=d.path, new_path=new_path))

    # Collect affected files
    files: list[File] = db.scalars(select(File).where(File.project_id == project_id)).all()
    affected_files: list[File] = [f for f in files if f.path == old_norm or f.path.startswith(old_norm + "/")]
    file_moves: list[FileMovePreview] = []
    for f in affected_files:
        suffix = f.path[len(old_norm) :]
        if suffix.startswith("/"):
            suffix = suffix[1:]
        new_path = new_norm if not suffix else f"{new_norm}/{suffix}"
        file_moves.append(FileMovePreview(file_id=f.id, old_path=f.path, new_path=new_path))

    if body.dry_run:
        _log_dir_event(
            "dir.move.dry_run",
            project_id,
            start,
            dirs=len(dir_changes),
            files=len(file_moves),
            old_path=old_norm,
            new_path=new_norm,
        )
        return DirectoryMoveDryRunResult(
            applied=False,
            dir_changes=dir_changes,
            file_moves=file_moves,
            dirs_count=len(dir_changes),
            files_count=len(file_moves),
        )

    # Apply on disk (best-effort): move top-level directory once
    proj_dir = os.path.join(settings.data_dir, "projects", proj.slug)
    old_abs = safe_join(proj_dir, "files", old_norm)
    new_abs = safe_join(proj_dir, "files", new_norm)
    try:
        # If old_abs exists and is a directory, move subtree
        if os.path.isdir(old_abs):
            os.makedirs(os.path.dirname(new_abs), exist_ok=True)
            shutil.move(old_abs, new_abs)
        else:
            os.makedirs(new_abs, exist_ok=True)
    except Exception:
        # Non-fatal; continue updating DB
        os.makedirs(new_abs, exist_ok=True)

    # Apply to DB for directories
    for ch in dir_changes:
        d = next((x for x in affected_dirs if x.path == ch.old_path), None)
        if d:
            d.path = ch.new_path
            d.name = ch.new_path.split("/")[-1]
            db.add(d)
    db.commit()

    # Apply to DB for files and reindex
    for mv in file_moves:
        f = db.get(File, mv.file_id)
        if not f:
            continue
        f.path = mv.new_path
        db.add(f)
        db.commit()
        db.refresh(f)
        # reindex with new path
        try:
            with engine.begin() as conn:
                index_file(conn, f.id, f"{f.title}\n{f.content_md}", title=f.title, path=f.path)
        except Exception:
            pass

    event_payload = {"old_path": old_norm, "new_path": new_norm, "dirs": len(dir_changes), "files": len(file_moves)}
    try:
        publish_event(project_id, "dir.moved", event_payload)
        if old_norm != new_norm:
            publish_event(project_id, "dir.renamed", event_payload)
    except Exception:
        pass
    _log_dir_event(
        "dir.move",
        project_id,
        start,
        dirs=len(dir_changes),
        files=len(file_moves),
        old_path=old_norm,
        new_path=new_norm,
    )
    return DirectoryMoveApplyResult(
        applied=True,
        dir_changes=dir_changes,
        file_moves=file_moves,
        dirs_count=len(dir_changes),
        files_count=len(file_moves),
    )


@router.delete("/{project_id}/dirs", response_model=DirectoryDeleteResult)
def delete_dir(project_id: str, body: DirectoryDeleteRequest, db: Session = Depends(get_db)):
    _validate_path(body.path)
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    start = time.perf_counter()
    norm = "/".join([seg for seg in body.path.split("/") if seg])
    # Check emptiness unless force
    if not body.force:
        has_files = db.scalars(select(File).where(File.project_id == project_id, File.path.like(norm + "%"))).first()
        has_subdirs = db.scalars(select(Directory).where(Directory.project_id == project_id, Directory.path.like(norm + "%"))).first()
        # If there is the directory itself only, allow deletion; else block
        if has_files or (has_subdirs and (has_subdirs.path != norm)):
            raise HTTPException(status_code=409, detail={"code": "DIR_NOT_EMPTY", "message": "Directory not empty"})

    # Delete subtree directories
    removed = 0
    dirs = db.scalars(select(Directory).where(Directory.project_id == project_id, Directory.path.like(norm + "%"))).all()
    for d in dirs:
        db.delete(d)
        removed += 1
    db.commit()

    # Remove on disk if empty or force
    proj_dir = os.path.join(settings.data_dir, "projects", proj.slug)
    abs_dir = safe_join(proj_dir, "files", norm)
    try:
        if os.path.isdir(abs_dir):
            # Only remove if empty or force
            if body.force:
                shutil.rmtree(abs_dir, ignore_errors=True)
            else:
                # Attempt rmdir if empty
                os.rmdir(abs_dir)
    except Exception:
        pass

    try:
        publish_event(project_id, "dir.deleted", {"path": norm, "removed": removed})
    except Exception:
        pass
    _log_dir_event("dir.delete", project_id, start, path=norm, removed_dirs=removed, forced=bool(body.force))
    return DirectoryDeleteResult(deleted=True, removed_dirs=removed)
