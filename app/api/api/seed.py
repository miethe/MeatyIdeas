from __future__ import annotations

import os

from sqlalchemy import select

from .db import SessionLocal
from .models import Project, File
from .utils import slugify


DEMO_NAME = "demo-idea-stream"


def ensure_seed() -> None:
    db = SessionLocal()
    try:
        existing = db.scalars(select(Project).where(Project.slug == DEMO_NAME)).first()
        if existing:
            return
        p = Project(name=DEMO_NAME, slug=DEMO_NAME, description="Demo project", tags=["demo"], status="idea")
        db.add(p)
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
        for path, content in files:
            f = File(project_id=p.id, path=path, title=os.path.basename(path), front_matter={}, content_md=content, rendered_html="", tags=["demo"]) 
            db.add(f)
            db.commit()
            db.refresh(f)

            # write to disk
            from .settings import settings
            from .utils import safe_join

            proj_dir = os.path.join(settings.data_dir, "projects", p.slug)
            os.makedirs(os.path.join(proj_dir, "files"), exist_ok=True)
            abs_path = safe_join(proj_dir, "files", path)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w") as fh:
                fh.write(content)
    finally:
        db.close()


if __name__ == "__main__":
    ensure_seed()

