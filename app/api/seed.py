from __future__ import annotations

import os

from sqlalchemy import select

from .db import SessionLocal, engine, init_db
from .migrations import run_upgrade_head
from .models import Project, File
from .search import index_file
from .services.tagging import set_project_tags
from .settings import settings
from .utils import safe_join


DEMO_NAME = "demo-idea-stream"


def ensure_seed() -> None:
    db_path = os.path.join(settings.data_dir, "app.sqlite3")
    if os.environ.get("PYTEST_CURRENT_TEST") and os.path.exists(db_path):
        os.remove(db_path)
        engine.dispose()
    run_upgrade_head()
    init_db()
    db = SessionLocal()
    try:
        existing = db.scalars(select(Project).where(Project.slug == DEMO_NAME)).first()
        if existing:
            return
        p = Project(name=DEMO_NAME, slug=DEMO_NAME, description="Demo project", status="idea")
        db.add(p)
        db.flush()
        set_project_tags(db, p, ["demo"])
        db.commit()
        db.refresh(p)

        files = [
            (
                "ideation/plan.md",
                "# Plan\n\n```mermaid\nsequenceDiagram\nA->>B: Hello\n```\n\nInline math: $a^2 + b^2 = c^2$\n",
            ),
            (
                "prd.md",
                "# Trimmed PRD\n\nThis is a demo PRD excerpt.",
            ),
        ]
        # lightweight renderer
        try:
            from markdown_it import MarkdownIt

            md = MarkdownIt("commonmark").enable("table").enable("strikethrough")
            def render(md_text: str) -> str:
                return md.render(md_text)
        except Exception:
            def render(md_text: str) -> str:
                return md_text

        for path, content in files:
            f = File(
                project_id=p.id,
                path=path,
                title=os.path.basename(path),
                front_matter={},
                content_md=content,
                rendered_html=render(content),
                tags=["demo"],
            ) 
            db.add(f)
            db.commit()
            db.refresh(f)

            # write to disk
            proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
            os.makedirs(os.path.join(proj_dir, "files"), exist_ok=True)
            abs_path = safe_join(proj_dir, "files", path)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w") as fh:
                fh.write(content)
            # index FTS (title + content)
            with engine.begin() as conn:
                index_file(conn, f.id, f"{f.title}\n{f.content_md}")
    finally:
        db.close()


if __name__ == "__main__":
    ensure_seed()
