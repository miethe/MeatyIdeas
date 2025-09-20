"""Add star and archive flags to projects"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250919_0003"
down_revision = "20250914_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("is_starred", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "projects",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("projects", "is_archived")
    op.drop_column("projects", "is_starred")
