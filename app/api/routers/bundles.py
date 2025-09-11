from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
import redis
import rq
from sqlalchemy.orm import Session

from ..events_pub import publish_event
from ..db import SessionLocal
from ..models import File, Project, Bundle
from ..schemas import BundleCreateRequest, BundleRead
from ..settings import settings
import json
import datetime as dt
import os
import zipfile
import hashlib
import yaml


router = APIRouter(prefix="/projects", tags=["bundles"])
bundles_router = APIRouter(prefix="/bundles", tags=["bundles"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/{project_id}/export/bundle", status_code=202)
def export_project_bundle(project_id: str, body: BundleCreateRequest, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    selection = body.selection or None
    file_ids = body.file_ids or []
    if selection and selection.file_ids:
        file_ids = selection.file_ids
    files = [db.get(File, fid) for fid in file_ids]
    files = [f for f in files if f]
    # translate DB files to on-disk relative paths
    file_rel_paths = [os.path.join("files", f.path) for f in files]
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    # Persist Bundle row (queued)
    meta = {
        "roles": (selection.roles if selection else {}),
        "include_checksums": body.include_checksums,
        "push_branch": body.push_branch,
        "open_pr": body.open_pr,
    }
    b = Bundle(project_id=p.id, selection={"file_ids": file_ids}, output_path="", status="queued", error="", bundle_metadata=meta, branch=None, pr_url=None)
    db.add(b)
    db.commit()
    db.refresh(b)
    # Enqueue background job
    q = rq.Queue("default", connection=redis.from_url(settings.redis_url))
    job = q.enqueue(
        "worker.jobs.bundle_jobs.export",
        slug=p.slug,
        project_id=p.id,
        project_name=p.name,
        file_rel_paths=file_rel_paths,
        include_checksums=body.include_checksums,
        push_branch=body.push_branch,
        open_pr=body.open_pr,
        roles=(selection.roles if selection else {}),
        bundle_id=b.id,
        job_timeout=600,
    )
    publish_event(project_id=p.id, event_type="bundle.queued", payload={"job_id": job.id, "bundle_id": b.id})
    return {"job_id": job.id, "bundle_id": b.id}


@bundles_router.get("/{bundle_id}", response_model=BundleRead)
def get_bundle(bundle_id: str, db: Session = Depends(get_db)):
    b = db.get(Bundle, bundle_id)
    if not b:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bundle"})
    return b


@router.get("/{project_id}/bundles", response_model=list[BundleRead])
def list_bundles(project_id: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    rows = db.query(Bundle).filter(Bundle.project_id == project_id).order_by(Bundle.created_at.desc()).all()
    return rows


@bundles_router.post("/{bundle_id}/verify")
def verify_bundle(bundle_id: str, db: Session = Depends(get_db)):
    b = db.get(Bundle, bundle_id)
    if not b:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Bundle"})
    if not b.output_path or not os.path.exists(b.output_path):
        raise HTTPException(status_code=400, detail={"code": "NOT_READY", "message": "Bundle file missing"})
    issues: list[str] = []
    try:
        with zipfile.ZipFile(b.output_path, "r") as zf:
            manifest_data = zf.read("bundle.yaml")
            manifest = yaml.safe_load(manifest_data)
            file_entries = manifest.get("files", [])
            for entry in file_entries:
                path = entry.get("path")
                recorded = entry.get("sha256") or ""
                if not path or recorded == "":
                    continue
                try:
                    with zf.open(path) as f:
                        h = hashlib.sha256()
                        while True:
                            chunk = f.read(8192)
                            if not chunk:
                                break
                            h.update(chunk)
                        actual = h.hexdigest()
                        if actual != recorded:
                            issues.append(f"checksum mismatch: {path}")
                except KeyError:
                    issues.append(f"missing file in zip: {path}")
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_ZIP", "message": str(e)})
    return {"ok": len(issues) == 0, "issues": issues}
