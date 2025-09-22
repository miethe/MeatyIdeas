from __future__ import annotations

import os
import mimetypes
import hashlib
import datetime as dt
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from markdown_it import MarkdownIt
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..db import SessionLocal, engine
from ..models import File, Project
from ..schemas import FileCreate, FileRead, LinkInfo, MoveFileRequest, MoveFileDryRunResult, MoveFileApplyResult, FilePreviewResponse
from ..settings import settings
from ..utils import safe_join
import os
from ..search import index_file
from ..links import upsert_links, rewrite_wikilinks, list_outgoing_links
import shutil
from ..events_pub import publish_event
from ..schemas import FilesBatchMoveRequest, FilesBatchMoveResult, FileMovePreview, DirectoryChange
from ..models import Directory


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


_PREVIEW_MAX_BYTES = 200_000
_TEXT_EXTENSIONS = {
    "md",
    "markdown",
    "py",
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "yaml",
    "yml",
    "sh",
    "css",
    "scss",
    "html",
    "txt",
    "rs",
    "go",
    "java",
    "kt",
    "swift",
    "c",
    "cpp",
    "sql",
}


def _utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _http_datetime(value):
    if not value:
        return None
    return dt.datetime.strftime(_utc(value), "%a, %d %b %Y %H:%M:%S GMT")


def _apply_cache_headers(response: Response, signature: str, last_modified):
    if signature:
        response.headers["ETag"] = hashlib.md5(signature.encode("utf-8")).hexdigest()
    lm = _http_datetime(last_modified)
    if lm:
        response.headers["Last-Modified"] = lm


def _infer_language(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    mapping = {
        "md": "Markdown",
        "markdown": "Markdown",
        "py": "Python",
        "ts": "TypeScript",
        "tsx": "TypeScript",
        "js": "JavaScript",
        "jsx": "JavaScript",
        "json": "JSON",
        "yaml": "YAML",
        "yml": "YAML",
        "sh": "Shell",
        "css": "CSS",
        "scss": "CSS",
        "html": "HTML",
        "txt": "Text",
        "rs": "Rust",
        "go": "Go",
        "java": "Java",
        "kt": "Kotlin",
        "swift": "Swift",
        "c": "C",
        "cpp": "C++",
        "sql": "SQL",
    }
    if ext in mapping:
        return mapping[ext]
    return ext.upper() if ext else "Other"


def _looks_plain_text(value: str) -> bool:
    snippet = value[:1000]
    return all(ord(ch) >= 32 or ch in "\n\r\t" for ch in snippet)


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
        index_file(conn, f.id, f"{f.title}\n{f.content_md}", title=f.title, path=f.path)
    # links
    upsert_links(db, project_id, f, body.content_md)
    return f


@router.get("/{file_id}", response_model=FileRead)
def get_file(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return f


@router.get("/{file_id}/preview", response_model=FilePreviewResponse)
def preview_file(file_id: str, response: Response, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})

    project = db.get(Project, f.project_id)
    proj_dir = None
    abs_path = None
    on_disk_size = None
    if project:
        proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
        try:
            abs_path = safe_join(proj_dir, "files", f.path)
            if os.path.isfile(abs_path):
                on_disk_size = os.path.getsize(abs_path)
        except Exception:
            abs_path = None
            on_disk_size = None

    raw_content = f.content_md or ""
    raw_size_bytes = len(raw_content.encode("utf-8"))
    preview_content = raw_content
    is_truncated = False
    if raw_size_bytes > _PREVIEW_MAX_BYTES:
        preview_content = raw_content[:_PREVIEW_MAX_BYTES]
        is_truncated = True

    size_bytes = on_disk_size or raw_size_bytes

    ext = f.path.rsplit(".", 1)[-1].lower() if "." in f.path else ""
    language = _infer_language(f.path)
    mime_type, _ = mimetypes.guess_type(f.path)

    preview_type = "text"
    preview_url: str | None = None
    if mime_type and mime_type.startswith("image/") and abs_path and os.path.isfile(abs_path):
        preview_type = "image"
        preview_content = None
        is_truncated = False
        preview_url = f"/files/{f.id}/raw"
    elif ext and ext not in _TEXT_EXTENSIONS and not _looks_plain_text(preview_content):
        preview_type = "binary"
        preview_content = None

    rendered_html = f.rendered_html if language == "Markdown" else None

    last_modified = _utc(f.updated_at)
    signature_parts = [
        f.id,
        last_modified.isoformat() if last_modified else "",
        str(size_bytes),
        preview_type,
    ]
    signature = "|".join(signature_parts)

    payload = FilePreviewResponse(
        id=f.id,
        project_id=f.project_id,
        path=f.path,
        title=f.title,
        size=size_bytes,
        mime_type=mime_type,
        encoding="utf-8",
        content=preview_content,
        rendered_html=rendered_html,
        is_truncated=is_truncated,
        preview_type=preview_type,
        preview_url=preview_url,
        language=language,
        updated_at=last_modified or dt.datetime.now(tz=dt.timezone.utc),
    )

    _apply_cache_headers(response, signature, last_modified)
    return payload


@router.get("/{file_id}/raw")
def get_file_raw(file_id: str, db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    project = db.get(Project, f.project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "PROJECT_NOT_FOUND"})

    proj_dir = os.path.join(settings.data_dir, "projects", project.slug)
    try:
        abs_path = safe_join(proj_dir, "files", f.path)
    except Exception:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})

    if abs_path and os.path.isfile(abs_path):
        mime_type, _ = mimetypes.guess_type(f.path)
        resp = FileResponse(abs_path, media_type=mime_type or "application/octet-stream", filename=os.path.basename(f.path))
        resp.headers["Content-Disposition"] = f"inline; filename=\"{os.path.basename(f.path)}\""
        return resp

    if f.content_md is not None:
        return Response(content=f.content_md, media_type="text/plain; charset=utf-8")

    raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})


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
        index_file(conn, f.id, f"{f.title}\n{f.content_md}", title=f.title, path=f.path)
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
                index_file(conn, rf.id, f"{rf.title}\n{rf.content_md}", title=rf.title, path=rf.path)
            upsert_links(db, rf.project_id, rf, rf.content_md)

    if will_move:
        try:
            if os.path.isfile(old_abs) and old_abs != new_abs:
                os.remove(old_abs)
        except Exception:
            pass

    # Emit event
    try:
        publish_event(f.project_id, "file.moved", {"file_id": f.id, "old_path": old_path_val, "new_path": new_path})
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


@router.post("/batch/move", response_model=FilesBatchMoveResult)
def batch_move(body: FilesBatchMoveRequest, db: Session = Depends(get_db)):
    failures: list[str] = []
    moved_files: list[FileMovePreview] = []
    moved_dirs: list[DirectoryChange] = []

    # Handle directory moves first
    for i, d in enumerate(body.dirs or []):
        try:
            from_pid = d.get("from_project_id") or ""
            to_pid = d.get("to_project_id") or from_pid
            old_path = d.get("path") or ""
            new_path = d.get("new_path") or ""
            if not from_pid or not old_path or not new_path:
                failures.append(f"dir[{i}]: missing fields")
                continue
            if any(seg in old_path for seg in ["..", "\\", ":"]) or any(seg in new_path for seg in ["..", "\\", ":"]):
                failures.append(f"dir[{i}]: bad path")
                continue
            from_proj = db.get(Project, from_pid)
            to_proj = db.get(Project, to_pid)
            if not from_proj or not to_proj:
                failures.append(f"dir[{i}]: project not found")
                continue
            old_norm = "/".join([seg for seg in old_path.split("/") if seg])
            new_norm = "/".join([seg for seg in new_path.split("/") if seg])

            # Collect affected files
            files = db.scalars(select(File).where(File.project_id == from_pid)).all()
            affected = [f for f in files if f.path == old_norm or f.path.startswith(old_norm + "/")]
            previews: list[FileMovePreview] = []
            for f in affected:
                suffix = f.path[len(old_norm) :]
                if suffix.startswith("/"):
                    suffix = suffix[1:]
                newp = new_norm if not suffix else f"{new_norm}/{suffix}"
                previews.append(FileMovePreview(file_id=f.id, old_path=f.path, new_path=newp))

            # Dry run mode
            if body.dry_run:
                moved_dirs.append(DirectoryChange(old_path=old_norm, new_path=new_norm))
                moved_files.extend(previews)
                continue

            # Apply on-disk move if same project; else ensure folders and move file-by-file
            if from_pid == to_pid:
                from_dir = os.path.join(settings.data_dir, "projects", from_proj.slug)
                old_abs = safe_join(from_dir, "files", old_norm)
                new_abs = safe_join(from_dir, "files", new_norm)
                try:
                    if os.path.isdir(old_abs):
                        os.makedirs(os.path.dirname(new_abs), exist_ok=True)
                        shutil.move(old_abs, new_abs)
                    else:
                        os.makedirs(new_abs, exist_ok=True)
                except Exception:
                    os.makedirs(new_abs, exist_ok=True)
            else:
                from_dir = os.path.join(settings.data_dir, "projects", from_proj.slug)
                to_dir = os.path.join(settings.data_dir, "projects", to_proj.slug)
                for pv in previews:
                    src = safe_join(from_dir, "files", pv.old_path)
                    dst = safe_join(to_dir, "files", pv.new_path)
                    os.makedirs(os.path.dirname(dst), exist_ok=True)
                    try:
                        if os.path.isfile(src):
                            shutil.move(src, dst)
                    except Exception:
                        # fallback: write from DB content
                        fobj = db.get(File, pv.file_id)
                        if fobj:
                            with open(dst, "w") as fh:
                                fh.write(fobj.content_md)

            # Update DB for directories (same-project only for persisted directories)
            if from_pid == to_pid:
                dirs = db.scalars(select(Directory).where(Directory.project_id == from_pid)).all()
                for drow in dirs:
                    if drow.path == old_norm or drow.path.startswith(old_norm + "/"):
                        suffix = drow.path[len(old_norm) :]
                        if suffix.startswith("/"):
                            suffix = suffix[1:]
                        drow.path = new_norm if not suffix else f"{new_norm}/{suffix}"
                        drow.name = drow.path.split("/")[-1]
                        db.add(drow)
                db.commit()
            else:
                # Move directory records across projects: replicate structure under dest
                dirs = db.scalars(select(Directory).where(Directory.project_id == from_pid)).all()
                for drow in dirs:
                    if drow.path == old_norm or drow.path.startswith(old_norm + "/"):
                        suffix = drow.path[len(old_norm) :]
                        if suffix.startswith("/"):
                            suffix = suffix[1:]
                        newp = new_norm if not suffix else f"{new_norm}/{suffix}"
                        db.add(Directory(project_id=to_pid, path=newp, name=(newp.split("/")[-1])))
                # Remove originals
                db.query(Directory).filter(Directory.project_id == from_pid, Directory.path.like(old_norm + "%")).delete(synchronize_session=False)
                db.commit()

            # Update DB for files
            for pv in previews:
                fobj = db.get(File, pv.file_id)
                if not fobj:
                    continue
                if from_pid != to_pid:
                    fobj.project_id = to_pid
                fobj.path = pv.new_path
                db.add(fobj)
                db.commit()
                db.refresh(fobj)
                # reindex
                try:
                    with engine.begin() as conn:
                        index_file(conn, fobj.id, f"{fobj.title}\n{fobj.content_md}", title=fobj.title, path=fobj.path)
                except Exception:
                    pass

            moved_dirs.append(DirectoryChange(old_path=old_norm, new_path=new_norm))
            moved_files.extend(previews)
        except Exception as e:
            failures.append(f"dir[{i}]: {getattr(e, 'detail', str(e))}")

    # Handle individual file moves
    for i, it in enumerate(body.files or []):
        try:
            fid = it.get("file_id")
            new_path = it.get("new_path")
            to_pid = it.get("to_project_id")
            if not fid or not new_path:
                failures.append(f"file[{i}]: missing fields")
                continue
            if any(seg in new_path for seg in ["..", "\\", ":"]):
                failures.append(f"file[{i}]: bad path")
                continue
            fobj = db.get(File, fid)
            if not fobj:
                failures.append(f"file[{i}]: not found")
                continue
            dest_pid = to_pid or fobj.project_id
            from_proj = db.get(Project, fobj.project_id)
            to_proj = db.get(Project, dest_pid)
            if not from_proj or not to_proj:
                failures.append(f"file[{i}]: project not found")
                continue
            oldp = fobj.path
            newp = "/".join([seg for seg in new_path.split("/") if seg])
            preview = FileMovePreview(file_id=fobj.id, old_path=oldp, new_path=newp)
            if body.dry_run:
                moved_files.append(preview)
                continue

            # Move on disk
            if fobj.project_id == dest_pid:
                base = os.path.join(settings.data_dir, "projects", from_proj.slug)
                src = safe_join(base, "files", oldp)
                dst = safe_join(base, "files", newp)
            else:
                base_from = os.path.join(settings.data_dir, "projects", from_proj.slug)
                base_to = os.path.join(settings.data_dir, "projects", to_proj.slug)
                src = safe_join(base_from, "files", oldp)
                dst = safe_join(base_to, "files", newp)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            try:
                if os.path.isfile(src):
                    shutil.move(src, dst)
                else:
                    # write from DB content if file missing
                    with open(dst, "w") as fh:
                        fh.write(fobj.content_md)
            except Exception:
                with open(dst, "w") as fh:
                    fh.write(fobj.content_md)

            # Update DB
            if fobj.project_id != dest_pid:
                fobj.project_id = dest_pid
            fobj.path = newp
            db.add(fobj)
            db.commit()
            db.refresh(fobj)
            # reindex
            try:
                with engine.begin() as conn:
                    index_file(conn, fobj.id, f"{fobj.title}\n{fobj.content_md}", title=fobj.title, path=fobj.path)
            except Exception:
                pass

            moved_files.append(preview)
        except Exception as e:
            failures.append(f"file[{i}]: {getattr(e, 'detail', str(e))}")

    # Publish a single batch event
    total_dirs = len(moved_dirs)
    total_files = len(moved_files)
    if total_dirs or total_files:
        # If mixed projects, project_id in payload is ambiguous; emit for each encountered project for visibility
        project_ids: set[str] = set()
        for mv in moved_files:
            fobj = db.get(File, mv.file_id)
            if fobj:
                project_ids.add(fobj.project_id)
        for pid in project_ids or {""}:
            try:
                publish_event(pid, "files.batch_moved", {"files": total_files, "dirs": total_dirs})
            except Exception:
                pass

    return FilesBatchMoveResult(
        applied=not body.dry_run,
        moved_files=moved_files,
        moved_dirs=moved_dirs,
        failures=failures,
        files_count=len(moved_files),
        dirs_count=len(moved_dirs),
    )
