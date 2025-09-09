from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import ArtifactRepo, Project
from ..schemas import ArtifactsCommitRequest, ArtifactsConnectRequest
from ..settings import settings
from ..git_ops import ensure_repo, commit_and_push, GitError


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
    try:
        result = commit_and_push(art_dir, body.paths, body.message)
    except GitError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message})
    return result

