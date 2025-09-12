from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import ArtifactRepo, Project
from ..schemas import ArtifactsCommitRequest, ArtifactsConnectRequest, ArtifactsStatus, CommitEntry
from ..settings import settings
from ..git_ops import ensure_repo, commit_and_push, GitError, repo_status, repo_history
from ..events_pub import publish_event


router = APIRouter(prefix="/projects", tags=["artifacts"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{project_id}/artifacts/connect")
def artifacts_connect(project_id: str, body: ArtifactsConnectRequest, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    try:
        ensure_repo(art_dir, body.repo_url)
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    # store row (one per project for MVP)
    existing = db.query(ArtifactRepo).filter(ArtifactRepo.project_id == project_id).first()
    if existing:
        existing.repo_url = body.repo_url
        existing.provider = body.provider
        existing.visibility = body.visibility
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return {"status": "updated"}
    ar = ArtifactRepo(project_id=project_id, repo_url=body.repo_url or "", provider=body.provider, visibility=body.visibility)
    db.add(ar)
    db.commit()
    publish_event(project_id=p.id, event_type="artifacts.connected", payload={"project_slug": p.slug})
    return {"status": "connected"}


@router.post("/{project_id}/artifacts/commit")
def artifacts_commit(project_id: str, body: ArtifactsCommitRequest, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    if not os.path.isdir(os.path.join(art_dir, ".git")):
        raise HTTPException(status_code=400, detail={"code": "NOT_CONNECTED", "message": "Artifacts repo not connected"})
    publish_event(project_id=p.id, event_type="commit.started", payload={"paths": body.paths})
    try:
        result = commit_and_push(art_dir, body.paths, body.message, push=body.push)
    except GitError as e:
        publish_event(project_id=p.id, event_type="commit.failed", payload={"code": e.code, "message": e.message})
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    publish_event(project_id=p.id, event_type="commit.completed", payload=result)
    return result


@router.get("/{project_id}/artifacts/status", response_model=ArtifactsStatus)
def artifacts_status(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    ar = db.query(ArtifactRepo).filter(ArtifactRepo.project_id == project_id).first()
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    if not os.path.isdir(os.path.join(art_dir, ".git")):
        return ArtifactsStatus(provider=ar.provider if ar else "local", repo_url=ar.repo_url if ar else None, branch=None, ahead=0, behind=0, last_sync=ar.last_synced_at if ar else None)
    try:
        st = repo_status(art_dir, (ar.default_branch if ar else None))
        return ArtifactsStatus(provider=ar.provider if ar else "local", repo_url=ar.repo_url if ar else None, branch=st.get("branch"), ahead=st.get("ahead", 0), behind=st.get("behind", 0), last_sync=ar.last_synced_at if ar else None)
    except GitError:
        # Gracefully degrade: return basic status without ahead/behind
        return ArtifactsStatus(provider=ar.provider if ar else "local", repo_url=ar.repo_url if ar else None, branch=ar.default_branch if ar else None, ahead=0, behind=0, last_sync=ar.last_synced_at if ar else None)


@router.get("/{project_id}/artifacts/history", response_model=list[CommitEntry])
def artifacts_history(project_id: str, limit: int = 20, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    art_dir = os.path.join(proj_dir, "artifacts")
    if not os.path.isdir(os.path.join(art_dir, ".git")):
        return []
    try:
        items = repo_history(art_dir, limit)
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    # Pydantic will coerce dicts to CommitEntry
    return items
