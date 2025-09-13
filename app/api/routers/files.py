from __future__ import annotations

import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from markdown_it import MarkdownIt
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import File, Project
from ..schemas import FileCreate, FileRead, LinkInfo, MoveFileRequest, MoveFileDryRunResult, MoveFileApplyResult
from ..settings import settings
from ..utils import safe_join
import os
from ..search import index_file
from ..links import upsert_links, rewrite_wikilinks, list_outgoing_links
import shutil


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
    # links
    upsert_links(db, project_id, f, body.content_md)
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
    old_title = f.title
    old_path = f.path
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
    # remove old on-disk file if path changed
    if old_path and old_path != body.path:
        try:
            old_abs = safe_join(proj_dir, "files", old_path)
            if os.path.isfile(old_abs) and old_abs != abs_path:
                os.remove(old_abs)
        except Exception:
            pass
    # index
    with engine.begin() as conn:
        index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    # links
    upsert_links(db, f.project_id, f, body.content_md)
    # rewrite links if title changed
    if body.rewrite_links and old_title and f.title != old_title:
        rewrite_wikilinks(db, f.project_id, old_title, f.title)
    return f


@router.get("/{file_id}/backlinks", response_model=List[FileRead])
def get_backlinks(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    # Backlinks: direct matches by target_file_id OR unresolved titles matching this file's title
    from ..models import Link
    src_ids = [
        l.src_file_id
        for l in db.query(Link).filter(
            (Link.project_id == f.project_id)
            & ((Link.target_file_id == f.id) | ((Link.target_file_id.is_(None)) & (Link.target_title == f.title)))
        ).all()
    ]
    rows = db.query(File).filter(File.id.in_(src_ids)).all()
    return rows


@router.get("/{file_id}/links", response_model=List[LinkInfo])
def get_outgoing_links(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    links = list_outgoing_links(db, file_id)
    return [LinkInfo(**l) for l in links]


@router.post("/{file_id}/move", response_model=MoveFileApplyResult | MoveFileDryRunResult)
def move_file(file_id: str, body: MoveFileRequest, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    project = db.get(Project, f.project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})

    # Validate paths
    new_path = body.new_path or f.path
    if any(seg in new_path for seg in ["..", "\\", ":"]):
        raise HTTPException(status_code=400, detail={"code": "BAD_PATH", "message": "Invalid path"})

    old_path_val = f.path
    will_move = new_path != f.path
    title_change = None
    if body.new_title and body.new_title != f.title:
        title_change = {"from": f.title, "to": body.new_title}

    # Compute files to rewrite if title changes
    rewrite_files: list[File] = []
    rewrite_count = 0
    if title_change and body.update_links:
        like = f"%[[{f.title}]]%"
        rewrite_files = db.query(File).filter(File.project_id == f.project_id, File.content_md.like(like)).all()
        rewrite_files = [x for x in rewrite_files if x.id != f.id]
        rewrite_count = len(rewrite_files)

    if body.dry_run:
        return MoveFileDryRunResult(
            will_move=will_move,
            old_path=old_path_val,
            new_path=new_path if will_move else None,
            title_change=title_change,
            files_to_rewrite=[{"id": x.id, "title": x.title} for x in rewrite_files],
            rewrite_count=rewrite_count,
            applied=False,
        )

    # Apply move/rename
    if body.new_title:
        f.title = body.new_title
    proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
    old_abs = safe_join(proj_dir, "files", f.path)
    new_abs = safe_join(proj_dir, "files", new_path)
    if will_move:
        os.makedirs(os.path.dirname(new_abs), exist_ok=True)
        try:
            if os.path.isfile(old_abs):
                shutil.move(old_abs, new_abs)
            else:
                with open(new_abs, "w") as fh:
                    fh.write(f.content_md)
        except Exception:
            with open(new_abs, "w") as fh:
                fh.write(f.content_md)
    f.path = new_path
    f.rendered_html = render_markdown(f.content_md)
    db.add(f)
    db.commit()
    db.refresh(f)

    with engine.begin() as conn:
        index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    upsert_links(db, f.project_id, f, f.content_md)

    if title_change and body.update_links and rewrite_files:
        old_t = title_change["from"]
        new_t = title_change["to"]
        for rf in rewrite_files:
            rf.content_md = rf.content_md.replace(f"[[{old_t}]]", f"[[{new_t}]]")
            rf.rendered_html = render_markdown(rf.content_md)
            db.add(rf)
            db.commit()
            db.refresh(rf)
            with engine.begin() as conn:
                index_file(conn, rf.id, f"{rf.title}\n{rf.content_md}")
            upsert_links(db, rf.project_id, rf, rf.content_md)

    if will_move:
        try:
            if os.path.isfile(old_abs) and old_abs != new_abs:
                os.remove(old_abs)
        except Exception:
            pass

    return MoveFileApplyResult(
        will_move=will_move,
        old_path=old_path_val,
        new_path=new_path if will_move else None,
        title_change=title_change,
        files_to_rewrite=[{"id": x.id, "title": x.title} for x in rewrite_files],
        rewrite_count=rewrite_count,
        applied=True,
        file=f,
    )


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
