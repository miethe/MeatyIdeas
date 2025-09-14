from __future__ import annotations

import base64
import datetime as dt
import os
from typing import Any

import redis
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Project, ShareLink, File
from ..schemas import ShareLinkCreate, ShareLinkRead
from ..settings import settings


router = APIRouter(tags=["sharing"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _gen_token(nbytes: int = 16) -> str:
    raw = os.urandom(nbytes)
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _require_sharing_enabled():
    if int(settings.share_links or 0) != 1:
        raise HTTPException(status_code=403, detail={"code": "DISABLED", "message": "Sharing disabled"})


@router.post("/projects/{project_id}/share-links", response_model=ShareLinkRead)
def create_share_link(project_id: str, body: ShareLinkCreate, db: Session = Depends(get_db)):
    _require_sharing_enabled()
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    # generate unique token
    token = _gen_token(16)
    tries = 0
    while db.query(ShareLink).filter(ShareLink.token == token).first() is not None and tries < 5:
        token = _gen_token(16)
        tries += 1
    sl = ShareLink(project_id=project_id, token=token, permissions="read", expires_at=body.expires_at, revoked_at=None)
    db.add(sl)
    db.commit()
    db.refresh(sl)
    return sl


@router.get("/projects/{project_id}/share-links", response_model=list[ShareLinkRead])
def list_share_links(project_id: str, db: Session = Depends(get_db)):
    _require_sharing_enabled()
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Project"})
    rows = db.query(ShareLink).filter(ShareLink.project_id == project_id).order_by(ShareLink.created_at.desc()).all()
    return rows


@router.delete("/share-links/{share_id}", status_code=204)
def revoke_share_link(share_id: str, db: Session = Depends(get_db)):
    _require_sharing_enabled()
    sl = db.get(ShareLink, share_id)
    if not sl:
        return
    sl.revoked_at = dt.datetime.now(tz=dt.timezone.utc)
    db.add(sl)
    db.commit()
    return


# Public endpoints (read-only)
public_router = APIRouter(prefix="/share", tags=["sharing-public"])


def _rate_limit_ok(ip: str, token: str) -> bool:
    try:
        r = redis.from_url(settings.redis_url)
        key = f"rate:share:{token}:{ip}:{dt.datetime.utcnow().strftime('%Y%m%d%H%M')}"
        n = r.incr(key)
        if n == 1:
            r.expire(key, 60)
        return n <= 120  # 120 req/min per IP per token
    except Exception:
        return True


def _get_share(db: Session, token: str) -> ShareLink:
    sl = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not sl:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Share"})
    if sl.revoked_at is not None:
        raise HTTPException(status_code=410, detail={"code": "REVOKED"})
    if sl.expires_at and sl.expires_at < dt.datetime.now(tz=dt.timezone.utc):
        raise HTTPException(status_code=410, detail={"code": "EXPIRED"})
    return sl


@public_router.get("/{token}/project")
def public_project(request: Request, token: str, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "-"
    if not _rate_limit_ok(ip, token):
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMIT"})
    sl = _get_share(db, token)
    p = db.get(Project, sl.project_id)
    if not p:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return {"id": p.id, "name": p.name, "slug": p.slug, "description": p.description, "tags": p.tags, "status": p.status}


@public_router.get("/{token}/files")
def public_files(request: Request, token: str, path: str | None = None, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "-"
    if not _rate_limit_ok(ip, token):
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMIT"})
    sl = _get_share(db, token)
    q = db.query(File).filter(File.project_id == sl.project_id)
    if path:
        q = q.filter(File.path.like(path.rstrip("/") + "%"))
    rows = q.with_entities(File.id, File.title, File.path).all()
    return [{"id": r[0], "title": r[1], "path": r[2]} for r in rows]


@public_router.get("/{token}/file")
def public_file(request: Request, token: str, path: str, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "-"
    if not _rate_limit_ok(ip, token):
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMIT"})
    sl = _get_share(db, token)
    f = db.query(File).filter(File.project_id == sl.project_id, File.path == path).first()
    if not f:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND"})
    return {"title": f.title, "path": f.path, "content": f.content_md}

