"""Baseline schema for MeatyProjects"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.sqlite import JSON

# revision identifiers, used by Alembic.
revision = "20250914_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    status_enum = sa.Enum("idea", "discovery", "draft", "live", name="status_enum")
    visibility_enum = sa.Enum("public", "private", name="visibility_enum")
    provider_enum = sa.Enum("github", "gitlab", "bitbucket", "local", name="provider_enum")
    scope_enum = sa.Enum("project", "global", name="scope_enum")

    status_enum.create(op.get_bind(), checkfirst=True)
    visibility_enum.create(op.get_bind(), checkfirst=True)
    provider_enum.create(op.get_bind(), checkfirst=True)
    scope_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", JSON, nullable=False, server_default="[]"),
        sa.Column("status", status_enum, nullable=False, server_default="idea"),
        sa.Column("color", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "user",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, server_default="Local User"),
        sa.Column("email", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("preferences", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "files",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("front_matter", JSON, nullable=False, server_default="{}"),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("rendered_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", JSON, nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "artifacts",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("repo_url", sa.String(length=512), nullable=True),
        sa.Column("default_branch", sa.String(length=255), nullable=False, server_default="main"),
        sa.Column("visibility", visibility_enum, nullable=False, server_default="private"),
        sa.Column("provider", provider_enum, nullable=False, server_default="local"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "repos",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("scope", scope_enum, nullable=False, server_default="project"),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("provider", provider_enum, nullable=False, server_default="local"),
        sa.Column("repo_url", sa.String(length=512), nullable=True),
        sa.Column("default_branch", sa.String(length=255), nullable=False, server_default="main"),
        sa.Column("visibility", visibility_enum, nullable=False, server_default="private"),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "directories",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "path", name="uix_directory_project_path"),
    )

    op.create_table(
        "bundles",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("selection", JSON, nullable=False, server_default="{}"),
        sa.Column("output_path", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("error", sa.Text(), nullable=False, server_default=""),
        sa.Column("bundle_metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("branch", sa.String(length=255), nullable=True),
        sa.Column("pr_url", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("type", sa.String(length=255), nullable=False),
        sa.Column("payload", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "links",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("src_file_id", sa.String(length=255), sa.ForeignKey("files.id"), nullable=False),
        sa.Column("src_path", sa.String(length=512), nullable=False),
        sa.Column("target_title", sa.String(length=255), nullable=False),
        sa.Column("target_file_id", sa.String(length=255), sa.ForeignKey("files.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "saved_searches",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column("query", sa.String(length=1024), nullable=False, server_default=""),
        sa.Column("filters", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "share_links",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("permissions", sa.String(length=50), nullable=False, server_default="read"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token", name="uq_share_links_token"),
    )

    op.create_table(
        "project_groups",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "project_group_memberships",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("project_id", sa.String(length=255), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("group_id", sa.String(length=255), sa.ForeignKey("project_groups.id"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("project_id", name="uq_group_membership_project"),
    )


def downgrade() -> None:
    op.drop_table("project_group_memberships")
    op.drop_table("project_groups")
    op.drop_table("share_links")
    op.drop_table("saved_searches")
    op.drop_table("links")
    op.drop_table("events")
    op.drop_table("bundles")
    op.drop_table("directories")
    op.drop_table("repos")
    op.drop_table("artifacts")
    op.drop_table("files")
    op.drop_table("user")
    op.drop_table("projects")

    sa.Enum(name="scope_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="provider_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="visibility_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="status_enum").drop(op.get_bind(), checkfirst=True)
