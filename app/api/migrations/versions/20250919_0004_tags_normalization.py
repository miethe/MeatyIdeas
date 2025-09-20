"""Tag normalization tables and backfill"""

from __future__ import annotations

import hashlib
import json
import re

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250919_0004"
down_revision = "20250919_0003"
branch_labels = None
depends_on = None


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "tag"


def _color_hex(slug: str) -> str:
    digest = hashlib.md5(slug.encode("utf-8")).hexdigest()
    return f"#{digest[:6]}"


def upgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "project_tags",
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )

    bind = op.get_bind()
    projects = bind.execute(sa.text("SELECT id, tags FROM projects")).fetchall()
    for project_id, tags_json in projects:
        if not tags_json:
            continue
        try:
            values = json.loads(tags_json)
        except Exception:
            continue
        for raw in values or []:
            label = " ".join(str(raw).strip().split())
            if not label:
                continue
            slug = _slugify(label)
            bind.execute(
                sa.text(
                    "INSERT OR IGNORE INTO tags (slug, label, color) VALUES (:slug, :label, :color)"
                ),
                {"slug": slug, "label": label, "color": _color_hex(slug)},
            )
            tag_id = bind.execute(sa.text("SELECT id FROM tags WHERE slug = :slug"), {"slug": slug}).scalar()
            if tag_id is None:
                continue
            bind.execute(
                sa.text(
                    "INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (:project_id, :tag_id)"
                ),
                {"project_id": project_id, "tag_id": tag_id},
            )


def downgrade() -> None:
    op.drop_table("project_tags")
    op.drop_table("tags")
