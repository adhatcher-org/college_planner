from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class UserRole(StrEnum):
    ADMIN = "admin"
    USER = "user"


class ScheduleFrequency(StrEnum):
    ONE_TIME = "one_time"
    MONTHLY = "monthly"
    EVERY_TWO_WEEKS = "every_two_weeks"
    SEMI_MONTHLY = "semi_monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    SEMI_YEARLY = "semi_yearly"


class ScheduleKind(StrEnum):
    DEPOSIT = "deposit"
    EXPENSE = "expense"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER)
    force_password_reset: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    children: Mapped[list["Child"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Child(Base):
    __tablename__ = "children"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    college_start_date: Mapped[date] = mapped_column(Date)
    college_end_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    owner: Mapped[User] = relationship(back_populates="children")
    account: Mapped["CollegeAccount"] = relationship(
        back_populates="child",
        cascade="all, delete-orphan",
        uselist=False,
    )


class CollegeAccount(Base):
    __tablename__ = "college_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("children.id"), unique=True, index=True)
    initial_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    expected_annual_return_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0.06"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    child: Mapped[Child] = relationship(back_populates="account")
    deposit_schedules: Mapped[list["DepositSchedule"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    expense_schedules: Mapped[list["ExpenseSchedule"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    forecast_scenarios: Mapped[list["ForecastScenario"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    balance_adjustments: Mapped[list["BalanceAdjustment"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    occurrence_overrides: Mapped[list["ScheduleOccurrenceOverride"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )
    investment_income_overrides: Mapped[list["InvestmentIncomeOverride"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
    )


class ScheduleMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("college_accounts.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(255))
    frequency: Mapped[ScheduleFrequency] = mapped_column(Enum(ScheduleFrequency))
    recurrence: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class DepositSchedule(ScheduleMixin, Base):
    __tablename__ = "deposit_schedules"
    account: Mapped[CollegeAccount] = relationship(back_populates="deposit_schedules")


class ExpenseSchedule(ScheduleMixin, Base):
    __tablename__ = "expense_schedules"
    account: Mapped[CollegeAccount] = relationship(back_populates="expense_schedules")


class ForecastScenario(Base):
    __tablename__ = "forecast_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("college_accounts.id"), index=True)
    yearly_college_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    existing_savings: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    one_time_contributions: Mapped[list] = mapped_column(JSON, default=list)
    yearly_contribution: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    expected_annual_return_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0.06"))
    recommended_monthly_contribution: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    user_selected_monthly_contribution: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    projected_shortfall: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    commentary: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    account: Mapped[CollegeAccount] = relationship(back_populates="forecast_scenarios")


class BalanceAdjustment(Base):
    __tablename__ = "balance_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("college_accounts.id"), index=True)
    adjustment_date: Mapped[date] = mapped_column(Date)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(255), default="Actual balance adjustment")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    account: Mapped[CollegeAccount] = relationship(back_populates="balance_adjustments")


class ScheduleOccurrenceOverride(Base):
    __tablename__ = "schedule_occurrence_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("college_accounts.id"), index=True)
    schedule_kind: Mapped[ScheduleKind] = mapped_column(Enum(ScheduleKind), index=True)
    schedule_id: Mapped[int] = mapped_column(index=True)
    original_date: Mapped[date] = mapped_column(Date, index=True)
    override_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    account: Mapped[CollegeAccount] = relationship(back_populates="occurrence_overrides")


class InvestmentIncomeOverride(Base):
    __tablename__ = "investment_income_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("college_accounts.id"), index=True)
    income_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    description: Mapped[str] = mapped_column(String(255), default="Projected investment income")
    is_deleted: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    account: Mapped[CollegeAccount] = relationship(back_populates="investment_income_overrides")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(500), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
