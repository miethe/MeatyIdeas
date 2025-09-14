from __future__ import annotations

import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Project, Repo
from ..schemas import RepoCreate, RepoOut, RepoStatus, Branch, CommitEntry
from ..settings import settings
from ..git_ops import (
    ensure_repo,
    GitError,
    repo_status as _repo_status,
    repo_history as _repo_history,
    list_branches as _list_branches,
    create_branch as _create_branch,
    checkout_branch as _checkout_branch,
    pull as _pull,
    push as _push,
    is_dirty as _is_dirty,
)
from ..events_pub import publish_event


router = APIRouter(prefix="/repos", tags=["repos"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_git_enabled():
    if int(settings.git_integration or 0) != 1:
        raise HTTPException(status_code=404, detail={"code": "NOT_ENABLED", "message": "Git integration disabled"})


def _repo_fs_path(db: Session, r: Repo) -> str:
    if r.scope == "project":
        if not r.project_id:
            raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Missing project_id for project-scoped repo"})
        p = db.get(Project, r.project_id)
        if not p:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
        return os.path.join(settings.data_dir, "projects", p.slug, "repos", r.id)
    else:
        return os.path.join(settings.data_dir, "repos", r.id)


@router.post("", response_model=RepoOut, status_code=201, dependencies=[Depends(require_git_enabled)])
def create_repo(body: RepoCreate, db: Session = Depends(get_db)):
    # Validate project when project scope
    proj = None
    if body.scope == "project":
        if not body.project_id:
            raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "project_id required for project scope"})
        proj = db.get(Project, body.project_id)
        if not proj:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    r = Repo(
        name=body.name or "repo",
        scope=body.scope,
        project_id=body.project_id,
        provider=body.provider or "local",
        repo_url=body.repo_url,
        visibility=body.visibility or "private",
        default_branch=(body.default_branch or "main"),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    # Ensure FS repo exists
    fs_path = _repo_fs_path(db, r)
    try:
        ensure_repo(fs_path, r.repo_url)
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    # Event
    if r.project_id:
        publish_event(project_id=r.project_id, event_type="repo.created", payload={"repo_id": r.id})
    return r


@router.get("", response_model=List[RepoOut], dependencies=[Depends(require_git_enabled)])
def list_repos(project_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Repo)
    if project_id:
        q = q.filter(Repo.project_id == project_id)
    else:
        q = q.filter(Repo.scope == "global")
    return q.all()


@router.delete("/{repo_id}", status_code=204, dependencies=[Depends(require_git_enabled)])
def delete_repo(repo_id: str, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    # Best-effort delete folder
    fs_path = _repo_fs_path(db, r)
    try:
        # avoid destructive recursive delete by default; only delete if empty or .git only
        if os.path.isdir(fs_path):
            # keep safety: do not rm -rf here
            pass
    except Exception:
        pass
    db.delete(r)
    db.commit()
    if r.project_id:
        publish_event(project_id=r.project_id, event_type="repo.deleted", payload={"repo_id": r.id})
    return None


@router.get("/{repo_id}/status", response_model=RepoStatus, dependencies=[Depends(require_git_enabled)])
def repo_status(repo_id: str, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        st = _repo_status(fs_path, r.default_branch)
        dirty = _is_dirty(fs_path)
        if r.project_id:
            publish_event(project_id=r.project_id, event_type="repo.status", payload={"repo_id": r.id, **st, "dirty": dirty})
        return RepoStatus(branch=st.get("branch"), ahead=st.get("ahead", 0), behind=st.get("behind", 0), dirty=dirty)
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.get("/{repo_id}/branches", response_model=List[Branch], dependencies=[Depends(require_git_enabled)])
def repo_branches(repo_id: str, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    return [Branch(**b) for b in _list_branches(fs_path)]


@router.post("/{repo_id}/branches", status_code=201, dependencies=[Depends(require_git_enabled)])
def repo_create_branch(repo_id: str, body: dict, db: Session = Depends(get_db)):
    name = body.get("name") if isinstance(body, dict) else None
    if not name:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Missing branch name"})
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        _create_branch(fs_path, name, checkout=True)
        if r.project_id:
            publish_event(project_id=r.project_id, event_type="repo.branch_created", payload={"repo_id": r.id, "name": name})
        return {"status": "ok"}
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.post("/{repo_id}/checkout", dependencies=[Depends(require_git_enabled)])
def repo_checkout(repo_id: str, body: dict, db: Session = Depends(get_db)):
    name = body.get("name") if isinstance(body, dict) else None
    if not name:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Missing branch name"})
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        _checkout_branch(fs_path, name)
        if r.project_id:
            publish_event(project_id=r.project_id, event_type="repo.checkout", payload={"repo_id": r.id, "name": name})
        return {"status": "ok"}
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.post("/{repo_id}/pull", dependencies=[Depends(require_git_enabled)])
def repo_pull(repo_id: str, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        res = _pull(fs_path)
        if r.project_id:
            publish_event(project_id=r.project_id, event_type="repo.pull", payload={"repo_id": r.id, **res})
        return res
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.post("/{repo_id}/push", dependencies=[Depends(require_git_enabled)])
def repo_push(repo_id: str, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        res = _push(fs_path)
        if r.project_id:
            publish_event(project_id=r.project_id, event_type="repo.push", payload={"repo_id": r.id, **res})
        return res
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})


@router.get("/{repo_id}/history", response_model=List[CommitEntry], dependencies=[Depends(require_git_enabled)])
def repo_history(repo_id: str, limit: int = 20, db: Session = Depends(get_db)):
    r = db.get(Repo, repo_id)
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Repo"})
    fs_path = _repo_fs_path(db, r)
    try:
        items = _repo_history(fs_path, limit)
        return items
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
