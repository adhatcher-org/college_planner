"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=500), nullable=False),
        sa.Column("role", sa.Enum("ADMIN", "USER", name="userrole"), nullable=False),
        sa.Column("force_password_reset", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "children",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("college_start_date", sa.Date(), nullable=False),
        sa.Column("college_end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_children_owner_id", "children", ["owner_id"])
    op.create_table(
        "college_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id"), nullable=False),
        sa.Column("initial_balance", sa.Numeric(12, 2), nullable=False),
        sa.Column("expected_annual_return_rate", sa.Numeric(8, 5), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_college_accounts_child_id", "college_accounts", ["child_id"], unique=True)
    for table_name in ("deposit_schedules", "expense_schedules"):
        op.create_table(
            table_name,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("account_id", sa.Integer(), sa.ForeignKey("college_accounts.id"), nullable=False),
            sa.Column("start_date", sa.Date(), nullable=False),
            sa.Column("end_date", sa.Date(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("description", sa.String(length=255), nullable=False),
            sa.Column(
                "frequency",
                sa.Enum(
                    "MONTHLY",
                    "EVERY_TWO_WEEKS",
                    "SEMI_MONTHLY",
                    "QUARTERLY",
                    "YEARLY",
                    "SEMI_YEARLY",
                    name="schedulefrequency",
                ),
                nullable=False,
            ),
            sa.Column("recurrence", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index(f"ix_{table_name}_account_id", table_name, ["account_id"])
    op.create_table(
        "forecast_scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("college_accounts.id"), nullable=False),
        sa.Column("yearly_college_cost", sa.Numeric(12, 2), nullable=False),
        sa.Column("existing_savings", sa.Numeric(12, 2), nullable=False),
        sa.Column("one_time_contributions", sa.JSON(), nullable=False),
        sa.Column("yearly_contribution", sa.Numeric(12, 2), nullable=False),
        sa.Column("expected_annual_return_rate", sa.Numeric(8, 5), nullable=False),
        sa.Column("recommended_monthly_contribution", sa.Numeric(12, 2), nullable=False),
        sa.Column("user_selected_monthly_contribution", sa.Numeric(12, 2), nullable=False),
        sa.Column("projected_shortfall", sa.Numeric(12, 2), nullable=False),
        sa.Column("commentary", sa.Text(), nullable=False),
        sa.Column("citations", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_forecast_scenarios_account_id", "forecast_scenarios", ["account_id"])
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=500), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_table("forecast_scenarios")
    op.drop_table("expense_schedules")
    op.drop_table("deposit_schedules")
    op.drop_table("college_accounts")
    op.drop_table("children")
    op.drop_table("users")
