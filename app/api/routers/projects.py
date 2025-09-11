from __future__ import annotations

import json
import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import Project
from ..models import File
from ..models import ArtifactRepo
from ..models import Bundle
from ..schemas import ProjectCreate, ProjectRead, FileRead
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


@router.get("", response_model=List[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    rows = db.scalars(select(Project)).all()
    return rows


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
