from __future__ import annotations

import os
import re
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Project
from ..settings import settings


router = APIRouter(prefix="/projects", tags=["attachments"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sanitize_filename(name: str) -> str:
    name = name.strip().replace(" ", "-")
    name = re.sub(r"[^a-zA-Z0-9._-]", "", name)
    return name or "file"


@router.post("/{project_id}/attachments/upload")
async def upload_attachment(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
    assets_dir = os.path.join(proj_dir, "artifacts", "assets")
    os.makedirs(assets_dir, exist_ok=True)
    fname = sanitize_filename(file.filename or "upload")
    path = os.path.join(assets_dir, fname)
    # Prevent overwrite by appending counter if exists
    base, ext = os.path.splitext(path)
    counter = 1
    while os.path.exists(path):
        path = f"{base}-{counter}{ext}"
        counter += 1
    with open(path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    rel = path.split(proj_dir + os.sep, 1)[-1]
    # Return Markdown-friendly path
    return {"path": rel.replace(os.sep, "/")}

