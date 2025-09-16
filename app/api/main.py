from __future__ import annotations

import os

from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import Base, engine, init_db
from .app_logging import setup_logging
from .models import *  # noqa
from .routers import projects, files, search, artifacts, bundles
from .routers import dirs as dirs_router
from .routers import repos as repos_router
from .routers import profile as profile_router
from .routers import config as config_router
from .routers import tags as tags_router
from .routers import events as events_router
from .routers import jobs as jobs_router
from .routers import attachments as attachments_router
from .routers import render as render_router
from .routers import import_export as import_export_router
from .routers import groups as groups_router
from .routers import sharing as sharing_router
from .settings import settings


setup_logging()

app = FastAPI(
    title="Idea Projects API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_token(x_token: str | None = Header(default=None)) -> None:
    if settings.token and x_token != settings.token:
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED"})


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)
    init_db()
    # Optional seed
    if int(settings.seed_demo or 0) == 1:
        from .seed import ensure_seed

        ensure_seed()
    # Ensure local user exists
    from .db import SessionLocal as _SessionLocal
    from .models import User as _User

    with _SessionLocal() as _db:
        u = _db.get(_User, "local")
        if not u:
            _db.add(_User(id="local", name="Local User", email="", avatar_url=None, preferences={}))
            _db.commit()
    # Phase 3: backfill directories from existing file paths when enabled
    try:
        if int(settings.dirs_persist or 0) == 1:
            from .models import Project as _Project
            from .models import File as _File
            from .models import Directory as _Directory

            with _SessionLocal() as _db:
                projects = _db.query(_Project).all()
                for p in projects:
                    # Build set of all parent directories from files
                    paths: set[str] = set()
                    files = _db.query(_File).filter(_File.project_id == p.id).all()
                    for f in files:
                        parts = [seg for seg in f.path.split("/") if seg]
                        acc: list[str] = []
                        for seg in parts[:-1]:
                            acc.append(seg)
                            paths.add("/".join(acc))
                    # Insert missing directories
                    if paths:
                        existing = {d.path for d in _db.query(_Directory).filter(_Directory.project_id == p.id).all()}
                        for dp in sorted(paths):
                            if dp not in existing:
                                _db.add(_Directory(project_id=p.id, path=dp, name=dp.split("/")[-1]))
                        _db.commit()
    except Exception:
        # Do not block startup on backfill issues
        pass


@app.get("/api/healthz")
def healthz():
    with engine.connect() as conn:
        conn.execute(text("select 1"))
    return {"status": "ok"}


auth = [Depends(verify_token)]
app.include_router(projects.router, prefix="/api", dependencies=auth)
app.include_router(files.router, prefix="/api", dependencies=auth)
app.include_router(search.router, prefix="/api", dependencies=auth)
app.include_router(artifacts.router, prefix="/api", dependencies=auth)
app.include_router(bundles.router, prefix="/api", dependencies=auth)
app.include_router(bundles.bundles_router, prefix="/api", dependencies=auth)
app.include_router(repos_router.router, prefix="/api", dependencies=auth)
app.include_router(dirs_router.router, prefix="/api", dependencies=auth)
app.include_router(events_router.router, prefix="/api")
app.include_router(jobs_router.router, prefix="/api", dependencies=auth)
app.include_router(attachments_router.router, prefix="/api", dependencies=auth)
app.include_router(render_router.router, prefix="/api", dependencies=auth)
app.include_router(profile_router.router, prefix="/api", dependencies=auth)
app.include_router(config_router.router, prefix="/api")
app.include_router(tags_router.router, prefix="/api", dependencies=auth)
app.include_router(import_export_router.router, prefix="/api", dependencies=auth)
app.include_router(sharing_router.router, prefix="/api", dependencies=auth)
app.include_router(sharing_router.public_router, prefix="/api")
app.include_router(groups_router.router, prefix="/api", dependencies=auth)
