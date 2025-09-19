"""Add allow_export flag to share links"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250914_0002"
down_revision = "20250914_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "share_links",
        sa.Column("allow_export", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("share_links", "allow_export")
