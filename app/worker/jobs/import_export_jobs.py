from __future__ import annotations

import datetime as dt
import io
import json
import os
import shutil
import tempfile
import zipfile
from typing import Iterable

import redis
from git import Repo  # type: ignore

from api.settings import settings as api_settings  # type: ignore
from api.db import SessionLocal  # type: ignore
from api.models import File as FileModel  # type: ignore
from api.models import Project as ProjectModel  # type: ignore
from api.models import Directory as DirectoryModel  # type: ignore
from api.search import index_file  # type: ignore
from api.events_pub import publish_event  # type: ignore
from api.utils import slugify  # type: ignore


def _publish(project_id: str, evt: str, payload: dict | None = None) -> None:
    try:
        publish_event(project_id, evt, payload or {})
    except Exception:
        try:
            r = redis.from_url(api_settings.redis_url)
            r.publish(f"events:{project_id}", json.dumps({"type": evt, "project_id": project_id, "payload": payload or {}}))
        except Exception:
            pass


def _safe_rel(path: str) -> str:
    path = path.replace("\\", "/")
    parts = [seg for seg in path.split("/") if seg and seg not in (".", "..")]
    return "/".join(parts)


def _ensure_dirs(db, project_id: str, file_rel_paths: Iterable[str]) -> None:
    try:
        dirs: set[str] = set()
        for rel in file_rel_paths:
            parts = rel.split("/")
            acc: list[str] = []
            for seg in parts[:-1]:
                acc.append(seg)
                dirs.add("/".join(acc))
        if not dirs:
            return
        existing = {d.path for d in db.query(DirectoryModel).filter(DirectoryModel.project_id == project_id).all()}
        for dp in sorted(dirs):
            if dp not in existing:
                db.add(DirectoryModel(project_id=project_id, path=dp, name=dp.split("/")[-1]))
        db.commit()
    except Exception:
        pass


def import_zip(*, project_id: str, zip_path: str, target_path: str | None = None, include_globs: list[str] | None = None, exclude_globs: list[str] | None = None) -> dict:
    db = SessionLocal()
    p = db.get(ProjectModel, project_id)
    if not p:
        raise RuntimeError("Project not found")
    _publish(project_id, "import.started", {"mode": "zip"})
    proj_dir = os.path.join(api_settings.data_dir, "projects", p.slug)
    to_dir = os.path.join(proj_dir, "files")
    if target_path:
        to_dir = os.path.join(to_dir, _safe_rel(target_path))
    os.makedirs(to_dir, exist_ok=True)
    count = 0
    imported: list[str] = []
    with zipfile.ZipFile(zip_path, "r") as z:
        for name in z.namelist():
            if name.endswith("/"):
                continue
            rel = _safe_rel(name)
            # apply include/exclude naive filtering
            if exclude_globs and any(rel.startswith(g.rstrip("*")) for g in exclude_globs):
                continue
            if include_globs and not any(rel.startswith(g.rstrip("*")) for g in include_globs):
                continue
            # Only import under files/
            dest_rel = rel
            if rel.startswith("files/"):
                dest_rel = rel.split("files/", 1)[1]
            # Read content
            with z.open(name) as f:
                data = f.read()
            try:
                text = data.decode("utf-8")
            except Exception:
                # skip binary for now
                continue
            # Write to disk
            out_rel = _safe_rel(os.path.join(_safe_rel(target_path or ""), dest_rel))
            abs_path = os.path.join(proj_dir, "files", out_rel)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w") as fh:
                fh.write(text)
            # Upsert DB row (by path)
            existing = db.query(FileModel).filter(FileModel.project_id == project_id, FileModel.path == out_rel).first()
            if existing:
                existing.content_md = text
                existing.rendered_html = existing.content_md  # server renders elsewhere
                db.add(existing)
                db.commit()
                db.refresh(existing)
                with db.bind.begin() as conn:  # type: ignore
                    index_file(conn, existing.id, f"{existing.title}\n{existing.content_md}", title=existing.title, path=existing.path)
            else:
                title = os.path.basename(out_rel) or "Untitled"
                fobj = FileModel(project_id=project_id, path=out_rel, title=title, front_matter={}, content_md=text, rendered_html=text, tags=[])
                db.add(fobj)
                db.commit()
                db.refresh(fobj)
                with db.bind.begin() as conn:  # type: ignore
                    index_file(conn, fobj.id, f"{fobj.title}\n{fobj.content_md}", title=fobj.title, path=fobj.path)
            count += 1
            imported.append(out_rel)
    _ensure_dirs(db, project_id, imported)
    _publish(project_id, "import.completed", {"files": count})
    return {"imported": count}


def import_json(*, project_id: str, json_path: str, target_path: str | None = None) -> dict:
    db = SessionLocal()
    p = db.get(ProjectModel, project_id)
    if not p:
        raise RuntimeError("Project not found")
    _publish(project_id, "import.started", {"mode": "json"})
    proj_dir = os.path.join(api_settings.data_dir, "projects", p.slug)
    with open(json_path, "r") as fh:
        data = json.load(fh)
    files = data.get("files", [])
    count = 0
    imported: list[str] = []
    for item in files:
        rel = _safe_rel(item.get("path", ""))
        if not rel:
            continue
        text = item.get("content", "")
        out_rel = _safe_rel(os.path.join(_safe_rel(target_path or ""), rel))
        abs_path = os.path.join(proj_dir, "files", out_rel)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w") as fh:
            fh.write(text)
        existing = db.query(FileModel).filter(FileModel.project_id == project_id, FileModel.path == out_rel).first()
        if existing:
            existing.content_md = text
            existing.rendered_html = text
            db.add(existing)
            db.commit()
            db.refresh(existing)
            with db.bind.begin() as conn:  # type: ignore
                index_file(conn, existing.id, f"{existing.title}\n{existing.content_md}", title=existing.title, path=existing.path)
        else:
            title = os.path.basename(out_rel) or "Untitled"
            fobj = FileModel(project_id=project_id, path=out_rel, title=title, front_matter={}, content_md=text, rendered_html=text, tags=[])
            db.add(fobj)
            db.commit()
            db.refresh(fobj)
            with db.bind.begin() as conn:  # type: ignore
                index_file(conn, fobj.id, f"{fobj.title}\n{fobj.content_md}", title=fobj.title, path=fobj.path)
        count += 1
        imported.append(out_rel)
    _ensure_dirs(db, project_id, imported)
    _publish(project_id, "import.completed", {"files": count})
    return {"imported": count}


def import_git(*, project_id: str, repo_url: str, include_globs: list[str] | None = None, exclude_globs: list[str] | None = None, target_path: str | None = None) -> dict:
    db = SessionLocal()
    p = db.get(ProjectModel, project_id)
    if not p:
        raise RuntimeError("Project not found")
    _publish(project_id, "import.started", {"mode": "git"})
    tmpdir = tempfile.mkdtemp(prefix="import_git_")
    try:
        Repo.clone_from(repo_url, tmpdir, depth=1)
        proj_dir = os.path.join(api_settings.data_dir, "projects", p.slug)
        to_dir = os.path.join(proj_dir, "files")
        if target_path:
            to_dir = os.path.join(to_dir, _safe_rel(target_path))
        os.makedirs(to_dir, exist_ok=True)
        count = 0
        imported: list[str] = []
        for root, _, files in os.walk(tmpdir):
            for fname in files:
                src = os.path.join(root, fname)
                rel = os.path.relpath(src, tmpdir).replace("\\", "/")
                rel = _safe_rel(rel)
                # filters
                if exclude_globs and any(rel.startswith(g.rstrip("*")) for g in exclude_globs):
                    continue
                if include_globs and not any(rel.startswith(g.rstrip("*")) for g in include_globs):
                    continue
                try:
                    with open(src, "rb") as fh:
                        data = fh.read()
                        text = data.decode("utf-8")
                except Exception:
                    continue
                out_rel = _safe_rel(os.path.join(_safe_rel(target_path or ""), rel))
                abs_path = os.path.join(to_dir, rel)
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                with open(abs_path, "w") as out:
                    out.write(text)
                existing = db.query(FileModel).filter(FileModel.project_id == project_id, FileModel.path == out_rel).first()
                if existing:
                    existing.content_md = text
                    existing.rendered_html = text
                    db.add(existing)
                    db.commit()
                    db.refresh(existing)
                    with db.bind.begin() as conn:  # type: ignore
                        index_file(conn, existing.id, f"{existing.title}\n{existing.content_md}", title=existing.title, path=existing.path)
                else:
                    title = os.path.basename(out_rel) or "Untitled"
                    fobj = FileModel(project_id=project_id, path=out_rel, title=title, front_matter={}, content_md=text, rendered_html=text, tags=[])
                    db.add(fobj)
                    db.commit()
                    db.refresh(fobj)
                    with db.bind.begin() as conn:  # type: ignore
                        index_file(conn, fobj.id, f"{fobj.title}\n{fobj.content_md}", title=fobj.title, path=fobj.path)
                count += 1
                imported.append(out_rel)
        _ensure_dirs(db, project_id, imported)
        _publish(project_id, "import.completed", {"files": count})
        return {"imported": count}
    except Exception as e:
        _publish(project_id, "import.failed", {"error": str(e)})
        raise
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _export_selection_paths(db, project_id: str, selection: dict | None) -> list[str]:
    from api.models import File as _File  # type: ignore
    paths: list[str] = []
    if selection and selection.get("file_ids"):
        for fid in selection.get("file_ids", []):
            f = db.get(_File, fid)
            if f:
                paths.append(f.path)
    if selection and selection.get("include_paths"):
        paths.extend(selection["include_paths"])  # assume safe from caller
    # de-duplicate
    out: list[str] = []
    for p in paths:
        rel = _safe_rel(p)
        if rel and rel not in out:
            out.append(rel)
    return out


def export_zip(*, project_id: str, selection: dict | None = None) -> dict:
    db = SessionLocal()
    p = db.get(ProjectModel, project_id)
    if not p:
        raise RuntimeError("Project not found")
    _publish(project_id, "export.started", {})
    proj_dir = os.path.join(api_settings.data_dir, "projects", p.slug)
    exports_dir = os.path.join(proj_dir, "exports")
    os.makedirs(exports_dir, exist_ok=True)
    ts = dt.datetime.now(tz=dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    zip_name = f"export-{p.slug}-{ts}.zip"
    zip_path = os.path.join(exports_dir, zip_name)
    sel_paths = _export_selection_paths(db, project_id, selection)
    # Write zip with project.json and files/
    proj_json_path = os.path.join(proj_dir, "project.json")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        if os.path.exists(proj_json_path):
            z.write(proj_json_path, arcname="project.json")
        base_files_dir = os.path.join(proj_dir, "files")
        if sel_paths:
            for rel in sel_paths:
                abs_path = os.path.join(base_files_dir, rel)
                if os.path.exists(abs_path):
                    z.write(abs_path, arcname=os.path.join("files", rel))
        else:
            for root, _, files in os.walk(base_files_dir):
                for fname in files:
                    abs_path = os.path.join(root, fname)
                    rel = os.path.relpath(abs_path, base_files_dir).replace("\\", "/")
                    z.write(abs_path, arcname=os.path.join("files", rel))
    url = f"/api/projects/{p.id}/exports/{zip_name}"
    _publish(project_id, "export.completed", {"url": url})
    return {"download": url}


def export_json(*, project_id: str, selection: dict | None = None) -> dict:
    db = SessionLocal()
    p = db.get(ProjectModel, project_id)
    if not p:
        raise RuntimeError("Project not found")
    _publish(project_id, "export.started", {})
    proj_dir = os.path.join(api_settings.data_dir, "projects", p.slug)
    exports_dir = os.path.join(proj_dir, "exports")
    os.makedirs(exports_dir, exist_ok=True)
    ts = dt.datetime.now(tz=dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_name = f"export-{p.slug}-{ts}.json"
    json_path = os.path.join(exports_dir, json_name)
    sel_paths = _export_selection_paths(db, project_id, selection)
    # Build JSON structure: project + files[{path, content}]
    data = {
        "project": {"id": p.id, "name": p.name, "slug": p.slug, "description": p.description, "tags": p.tags, "status": p.status},
        "files": [],
    }
    base_files_dir = os.path.join(proj_dir, "files")
    if sel_paths:
        rels = sel_paths
    else:
        rels = []
        for root, _, files in os.walk(base_files_dir):
            for fname in files:
                abs_path = os.path.join(root, fname)
                rel = os.path.relpath(abs_path, base_files_dir).replace("\\", "/")
                rels.append(rel)
    for rel in rels:
        abs_path = os.path.join(base_files_dir, rel)
        try:
            with open(abs_path, "r") as fh:
                text = fh.read()
        except Exception:
            text = ""
        data["files"].append({"path": rel, "content": text})
    with open(json_path, "w") as out:
        json.dump(data, out)
    url = f"/api/projects/{p.id}/exports/{json_name}"
    _publish(project_id, "export.completed", {"url": url})
    return {"download": url}

