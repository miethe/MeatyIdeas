from __future__ import annotations

import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from markdown_it import MarkdownIt
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import File, Project
from ..schemas import FileCreate, FileRead
from ..settings import settings
from ..utils import safe_join
import os
from ..search import index_file


router = APIRouter(prefix="/files", tags=["files"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


md = MarkdownIt("commonmark").enable("table").enable("strikethrough")


def render_markdown(md_text: str) -> str:
    # MVP: basic Markdown render; Mermaid/KaTeX handled on client later
    return md.render(md_text)


@router.post("/project/{project_id}", response_model=FileRead, status_code=201)
def create_file(project_id: str, body: FileCreate, db: Session = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    title = body.title or os.path.basename(body.path) or "Untitled"
    rendered = render_markdown(body.content_md)
    f = File(
        project_id=project_id,
        path=body.path,
        title=title,
        front_matter=body.front_matter,
        content_md=body.content_md,
        rendered_html=rendered,
        tags=body.tags,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    # write to disk
    proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
    abs_path = safe_join(proj_dir, "files", body.path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w") as fh:
        fh.write(body.content_md)
    # index
    with engine.begin() as conn:
        index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    return f


@router.get("/{file_id}", response_model=FileRead)
def get_file(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return f


@router.put("/{file_id}", response_model=FileRead)
def update_file(file_id: str, body: FileCreate, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    f.path = body.path
    f.title = body.title or f.title
    f.front_matter = body.front_matter
    f.content_md = body.content_md
    f.rendered_html = render_markdown(body.content_md)
    f.tags = body.tags
    db.add(f)
    db.commit()
    db.refresh(f)
    # update disk
    project = db.get(Project, f.project_id)
    proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
    abs_path = safe_join(proj_dir, "files", body.path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w") as fh:
        fh.write(body.content_md)
    # index
    with engine.begin() as conn:
        index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    return f


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        return
    # remove on-disk file if present
    try:
        project = db.get(Project, f.project_id)
        if project:
            proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
            abs_path = safe_join(proj_dir, "files", f.path)
            if os.path.isfile(abs_path):
                os.remove(abs_path)
    except Exception:
        # best-effort removal; continue with DB deletion
        pass
    db.delete(f)
    db.commit()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM search_index WHERE file_id = :fid"), {"fid": file_id})
    return
