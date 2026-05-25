"""balance adjustments and occurrence overrides

Revision ID: 0002_balance_and_occurrence_overrides
Revises: 0001_initial
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_balance_and_occurrence_overrides"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "balance_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("college_accounts.id"), nullable=False),
        sa.Column("adjustment_date", sa.Date(), nullable=False),
        sa.Column("balance", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_balance_adjustments_account_id", "balance_adjustments", ["account_id"])
    op.create_table(
        "schedule_occurrence_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("college_accounts.id"), nullable=False),
        sa.Column("schedule_kind", sa.Enum("DEPOSIT", "EXPENSE", name="schedulekind"), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("original_date", sa.Date(), nullable=False),
        sa.Column("override_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_schedule_occurrence_overrides_account_id", "schedule_occurrence_overrides", ["account_id"])
    op.create_index("ix_schedule_occurrence_overrides_schedule_kind", "schedule_occurrence_overrides", ["schedule_kind"])
    op.create_index("ix_schedule_occurrence_overrides_schedule_id", "schedule_occurrence_overrides", ["schedule_id"])
    op.create_index("ix_schedule_occurrence_overrides_original_date", "schedule_occurrence_overrides", ["original_date"])


def downgrade() -> None:
    op.drop_table("schedule_occurrence_overrides")
    op.drop_table("balance_adjustments")
