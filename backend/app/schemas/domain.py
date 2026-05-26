from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ScheduleFrequency, ScheduleKind, UserRole


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    force_password_reset: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    force_password_reset: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=8)


class ForcedPasswordReset(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ChildCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    college_start_date: date
    college_end_date: date | None = None
    initial_balance: Decimal = Decimal("0")
    expected_annual_return_rate: Decimal = Decimal("0.06")


class ChildUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    college_start_date: date | None = None
    college_end_date: date | None = None
    initial_balance: Decimal | None = None
    expected_annual_return_rate: Decimal | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    initial_balance: Decimal
    expected_annual_return_rate: Decimal


class ChildRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    college_start_date: date
    college_end_date: date
    account: AccountRead


class ScheduleBase(BaseModel):
    start_date: date
    end_date: date
    amount: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=255)
    frequency: ScheduleFrequency
    recurrence: dict[str, Any] = Field(default_factory=dict)


class ScheduleCreate(ScheduleBase):
    account_id: int


class ScheduleUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    frequency: ScheduleFrequency | None = None
    recurrence: dict[str, Any] | None = None


class ScheduleRead(ScheduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int


class RegistryRow(BaseModel):
    date: date
    description: str
    type: Literal["deposit", "expense", "investment_income", "opening_balance", "balance_adjustment"]
    deposit_amount: Decimal = Decimal("0")
    expense_amount: Decimal = Decimal("0")
    investment_income_amount: Decimal = Decimal("0")
    running_balance: Decimal
    source_schedule_id: int | None = None
    source_schedule_kind: ScheduleKind | None = None
    original_date: date | None = None
    override_id: int | None = None


class RegistryGroup(BaseModel):
    period: str
    total_deposits: Decimal
    total_expenses: Decimal
    total_investment_income: Decimal
    ending_balance: Decimal


class RegistryResponse(BaseModel):
    rows: list[RegistryRow] = Field(default_factory=list)
    groups: list[RegistryGroup] = Field(default_factory=list)


class BalanceAdjustmentCreate(BaseModel):
    adjustment_date: date
    balance: Decimal = Field(ge=0)
    description: str = Field(default="Actual balance adjustment", min_length=1, max_length=255)


class BalanceAdjustmentRead(BalanceAdjustmentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int


class InvestmentIncomeOverrideCreate(BaseModel):
    income_date: date
    amount: Decimal = Field(ge=0)
    description: str = Field(default="Projected investment income", min_length=1, max_length=255)


class InvestmentIncomeOverrideRead(InvestmentIncomeOverrideCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int


class OccurrenceOverrideCreate(BaseModel):
    account_id: int
    schedule_kind: ScheduleKind
    schedule_id: int
    original_date: date
    override_date: date
    amount: Decimal = Field(gt=0)
    description: str | None = Field(default=None, max_length=255)


class OccurrenceOverrideRead(OccurrenceOverrideCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ForecastRequest(BaseModel):
    account_id: int
    yearly_college_cost: Decimal | None = Field(default=None, gt=0)
    use_search_estimate: bool = False
    transient_income: Decimal | None = Field(default=None, gt=0)
    existing_savings: Decimal = Decimal("0")
    one_time_contributions: list[dict[str, Any]] = Field(default_factory=list)
    yearly_contribution: Decimal = Decimal("0")
    expected_annual_return_rate: Decimal = Decimal("0.06")
    user_selected_monthly_contribution: Decimal | None = Field(default=None, ge=0)


class ForecastResponse(BaseModel):
    id: int | None = None
    yearly_college_cost: Decimal
    recommended_monthly_contribution: Decimal
    user_selected_monthly_contribution: Decimal
    projected_shortfall: Decimal
    commentary: str
    citations: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime | None = None
