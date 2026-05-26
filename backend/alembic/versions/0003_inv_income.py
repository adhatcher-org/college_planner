"""investment income overrides

Revision ID: 0003_inv_income
Revises: 0002_bal_and_occ_overrides
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_inv_income"
down_revision: str | None = "0002_bal_and_occ_overrides"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE schedulefrequency ADD VALUE IF NOT EXISTS 'ONE_TIME'")

    op.add_column("schedule_occurrence_overrides", sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_table(
        "investment_income_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("college_accounts.id"), nullable=False),
        sa.Column("income_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_investment_income_overrides_account_id", "investment_income_overrides", ["account_id"])
    op.create_index("ix_investment_income_overrides_income_date", "investment_income_overrides", ["income_date"])


def downgrade() -> None:
    op.drop_index("ix_investment_income_overrides_income_date", table_name="investment_income_overrides")
    op.drop_index("ix_investment_income_overrides_account_id", table_name="investment_income_overrides")
    op.drop_table("investment_income_overrides")
    op.drop_column("schedule_occurrence_overrides", "is_deleted")
