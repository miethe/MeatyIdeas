from __future__ import annotations

import os

from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import Base, engine, init_db
from .app_logging import setup_logging
from .models import *  # noqa
from .routers import projects, files, search, artifacts, bundles
from .routers import events as events_router
from .routers import jobs as jobs_router
from .routers import attachments as attachments_router
from .routers import render as render_router
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
app.include_router(events_router.router, prefix="/api")
app.include_router(jobs_router.router, prefix="/api", dependencies=auth)
app.include_router(attachments_router.router, prefix="/api", dependencies=auth)
app.include_router(render_router.router, prefix="/api", dependencies=auth)
