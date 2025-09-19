from __future__ import annotations

import io
import json
import os
import tempfile
import zipfile
from typing import Any

import redis
import rq
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Project
from ..schemas import ProjectExportRequest, JobEnqueueResponse
from ..settings import settings
from ..app_logging import get_logger


router = APIRouter(prefix="/projects", tags=["import_export"])
logger = get_logger(component="import_export.api")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _rq() -> rq.Queue:
    return rq.Queue("default", connection=redis.from_url(settings.redis_url))


@router.post("/import", response_model=JobEnqueueResponse, status_code=202)
async def import_project(
    mode: str = Form(...),
    project_id: str | None = Form(default=None),
    target_path: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] | None = File(default=None),
    body: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    if mode not in {"zip", "files", "json", "git"}:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Unsupported mode"})
    pid = project_id
    created_project = False
    if not pid:
        # Create a new project if not provided
        name = f"Imported {os.urandom(3).hex()}"
        p = Project(name=name, slug=name.lower().replace(" ", "-"))
        db.add(p)
        db.commit()
        db.refresh(p)
        pid = p.id
        created_project = True
        # Ensure folders
        proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
        os.makedirs(os.path.join(proj_dir, "files"), exist_ok=True)
        os.makedirs(os.path.join(proj_dir, "exports"), exist_ok=True)
        with open(os.path.join(proj_dir, "project.json"), "w") as fh:
            json.dump({"id": p.id, "name": p.name, "slug": p.slug, "description": p.description, "tags": p.tags, "status": p.status}, fh)
        logger.info("import.auto_project", project_id=pid, slug=p.slug)
    # enqueue appropriate job
    q = _rq()
    if mode == "zip":
        if not file:
            raise HTTPException(status_code=400, detail={"code": "BAD_UPLOAD", "message": "file required"})
        tmpdir = tempfile.mkdtemp(prefix="import_zip_")
        path = os.path.join(tmpdir, file.filename or "upload.zip")
        with open(path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        job = q.enqueue(
            "worker.jobs.import_export_jobs.import_zip",
            project_id=pid,
            zip_path=path,
            target_path=target_path,
            job_timeout=600,
        )
    elif mode == "files":
        uploads = files or ([] if file is None else [file])
        if not uploads:
            raise HTTPException(status_code=400, detail={"code": "BAD_UPLOAD", "message": "files required"})
        # Package into a zip to reuse import_zip logic
        tmpdir = tempfile.mkdtemp(prefix="import_files_")
        zip_path = os.path.join(tmpdir, "files.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for up in uploads:
                fname = os.path.basename(up.filename or "file")
                data = await up.read()
                z.writestr(fname, data)
        job = q.enqueue(
            "worker.jobs.import_export_jobs.import_zip",
            project_id=pid,
            zip_path=zip_path,
            target_path=target_path,
            job_timeout=600,
        )
    elif mode == "json":
        if not file:
            raise HTTPException(status_code=400, detail={"code": "BAD_UPLOAD", "message": "file required"})
        tmpdir = tempfile.mkdtemp(prefix="import_json_")
        path = os.path.join(tmpdir, file.filename or "project.json")
        with open(path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        job = q.enqueue(
            "worker.jobs.import_export_jobs.import_json",
            project_id=pid,
            json_path=path,
            target_path=target_path,
            job_timeout=600,
        )
    else:  # git
        # repo_url can be passed in body form as JSON string or separate field in future
        repo_url = None
        if body:
            try:
                data = json.loads(body)
                repo_url = data.get("repo_url")
            except Exception:
                pass
        if not repo_url:
            raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "repo_url required"})
        job = q.enqueue(
            "worker.jobs.import_export_jobs.import_git",
            project_id=pid,
            repo_url=repo_url,
            target_path=target_path,
            job_timeout=1200,
        )
    logger.info(
        "import.enqueue",
        project_id=pid,
        job_id=job.id,
        mode=mode,
        target_path=target_path,
        created_project=created_project,
    )
    return JobEnqueueResponse(job_id=job.id, result_url=None)


@router.post("/{project_id}/export", response_model=JobEnqueueResponse, status_code=202)
def export_project(project_id: str, body: ProjectExportRequest, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    q = _rq()
    if body.mode == "json":
        job = q.enqueue(
            "worker.jobs.import_export_jobs.export_json",
            project_id=project_id,
            selection=body.selection.dict() if body.selection else None,
            job_timeout=600,
        )
    else:
        job = q.enqueue(
            "worker.jobs.import_export_jobs.export_zip",
            project_id=project_id,
            selection=body.selection.dict() if body.selection else None,
            job_timeout=600,
        )
    logger.info(
        "export.enqueue",
        project_id=project_id,
        job_id=job.id,
        mode=body.mode,
        selection_provided=bool(body.selection),
    )
    return JobEnqueueResponse(job_id=job.id, result_url=None)


@router.get("/{project_id}/exports/{name}")
def download_export(project_id: str, name: str, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    exports_dir = os.path.join(proj_dir, "exports")
    path = os.path.join(exports_dir, name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Export not found"})
    media = "application/json" if name.endswith(".json") else "application/zip"
    return FileResponse(path, media_type=media, filename=name)
