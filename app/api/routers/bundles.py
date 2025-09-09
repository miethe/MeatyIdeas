from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..bundle import export_bundle
from ..db import SessionLocal
from ..models import File, Project
from ..schemas import BundleCreateRequest, BundleCreateResponse
from ..settings import settings


router = APIRouter(prefix="/projects", tags=["bundles"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{project_id}/export/bundle", response_model=BundleCreateResponse, status_code=201)
def export_project_bundle(project_id: str, body: BundleCreateRequest, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    files = [db.get(File, fid) for fid in body.file_ids]
    files = [f for f in files if f]
    # translate DB files to on-disk relative paths
    file_rel_paths = [os.path.join("files", f.path) for f in files]
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    zip_path = export_bundle(project_name=p.name, project_slug=p.slug, project_dir=proj_dir, file_rel_paths=file_rel_paths)
    response = BundleCreateResponse(zip_path=zip_path, branch=None)
    return response

