from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models import (
    BalanceAdjustment,
    CollegeAccount,
    DepositSchedule,
    ExpenseSchedule,
    InvestmentIncomeOverride,
    ScheduleKind,
    ScheduleOccurrenceOverride,
)
from app.schemas import RegistryGroup, RegistryResponse, RegistryRow
from app.services.dates import add_months, month_end
from app.services.recurrence import expand_schedule

TWOPLACES = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def monthly_rate(annual_rate: Decimal) -> Decimal:
    return Decimal((1 + float(annual_rate)) ** (1 / 12) - 1)


def project_registry(
    db: Session,
    account: CollegeAccount,
    range_start: date,
    range_end: date,
    description: str | None = None,
    row_type: str | None = None,
    grouping: str = "none",
    sort: str = "date_asc",
) -> RegistryResponse:
    calculation_rows: list[dict] = [
        {
            "date": range_start,
            "description": "Opening balance",
            "type": "opening_balance",
            "deposit_amount": Decimal("0"),
            "expense_amount": Decimal("0"),
            "investment_income_amount": Decimal("0"),
            "source_schedule_id": None,
            "sort_weight": 0,
        }
    ]

    deposits = db.query(DepositSchedule).filter(DepositSchedule.account_id == account.id).all()
    expenses = db.query(ExpenseSchedule).filter(ExpenseSchedule.account_id == account.id).all()
    overrides = {
        (override.schedule_kind, override.schedule_id, override.original_date): override
        for override in db.query(ScheduleOccurrenceOverride)
        .filter(ScheduleOccurrenceOverride.account_id == account.id)
        .all()
    }
    expansion_start = min([range_start, *[override.original_date for override in overrides.values()]])
    expansion_end = max([range_end, *[override.original_date for override in overrides.values()]])
    investment_income_overrides = {
        override.income_date: override
        for override in db.query(InvestmentIncomeOverride)
        .filter(
            InvestmentIncomeOverride.account_id == account.id,
            InvestmentIncomeOverride.income_date >= range_start,
            InvestmentIncomeOverride.income_date <= range_end,
        )
        .all()
    }

    for occurrence in [item for schedule in deposits for item in expand_schedule(schedule, expansion_start, expansion_end)]:
        override = overrides.get((ScheduleKind.DEPOSIT, occurrence.source_schedule_id, occurrence.date))
        if override and override.is_deleted:
            continue
        occurs_on = override.override_date if override else occurrence.date
        if not range_start <= occurs_on <= range_end:
            continue
        amount = override.amount if override else occurrence.amount
        calculation_rows.append(
            {
                "date": occurs_on,
                "description": override.description or occurrence.description if override else occurrence.description,
                "type": "deposit",
                "deposit_amount": amount,
                "expense_amount": Decimal("0"),
                "investment_income_amount": Decimal("0"),
                "source_schedule_id": occurrence.source_schedule_id,
                "source_schedule_kind": ScheduleKind.DEPOSIT,
                "original_date": occurrence.date,
                "override_id": override.id if override else None,
                "sort_weight": 1,
            }
        )
    for occurrence in [item for schedule in expenses for item in expand_schedule(schedule, expansion_start, expansion_end)]:
        override = overrides.get((ScheduleKind.EXPENSE, occurrence.source_schedule_id, occurrence.date))
        if override and override.is_deleted:
            continue
        occurs_on = override.override_date if override else occurrence.date
        if not range_start <= occurs_on <= range_end:
            continue
        amount = override.amount if override else occurrence.amount
        calculation_rows.append(
            {
                "date": occurs_on,
                "description": override.description or occurrence.description if override else occurrence.description,
                "type": "expense",
                "deposit_amount": Decimal("0"),
                "expense_amount": amount,
                "investment_income_amount": Decimal("0"),
                "source_schedule_id": occurrence.source_schedule_id,
                "source_schedule_kind": ScheduleKind.EXPENSE,
                "original_date": occurrence.date,
                "override_id": override.id if override else None,
                "sort_weight": 2,
            }
        )

    for adjustment in (
        db.query(BalanceAdjustment)
        .filter(
            BalanceAdjustment.account_id == account.id,
            BalanceAdjustment.adjustment_date >= range_start,
            BalanceAdjustment.adjustment_date <= range_end,
        )
        .all()
    ):
        calculation_rows.append(
            {
                "date": adjustment.adjustment_date,
                "description": adjustment.description,
                "type": "balance_adjustment",
                "deposit_amount": Decimal("0"),
                "expense_amount": Decimal("0"),
                "investment_income_amount": Decimal("0"),
                "source_schedule_id": None,
                "source_schedule_kind": None,
                "original_date": None,
                "override_id": adjustment.id,
                "target_balance": adjustment.balance,
                "sort_weight": 3,
            }
        )

    balance = Decimal(account.initial_balance)
    rows: list[RegistryRow] = []
    rate = monthly_rate(Decimal(account.expected_annual_return_rate))
    current_month = date(range_start.year, range_start.month, 1)
    last_month = date(range_end.year, range_end.month, 1)

    while current_month <= last_month:
        period_end = min(month_end(current_month), range_end)
        period_rows = [
            row for row in calculation_rows if current_month <= row["date"] <= period_end
        ]
        for row in sorted(period_rows, key=lambda item: (item["date"], item["sort_weight"], item["description"])):
            if row["type"] == "balance_adjustment":
                balance = Decimal(row["target_balance"])
            else:
                balance += row["deposit_amount"] - row["expense_amount"] + row["investment_income_amount"]
            row_data = {
                k: v for k, v in row.items() if k not in {"sort_weight", "target_balance"}
            }
            rows.append(RegistryRow(running_balance=money(balance), **row_data))

        if period_end >= range_start:
            income_override = investment_income_overrides.get(period_end)
            if income_override and income_override.is_deleted:
                current_month = add_months(current_month, 1)
                continue
            income = money(income_override.amount if income_override else max(balance, Decimal("0")) * rate)
            if income or income_override:
                balance += income
                rows.append(
                    RegistryRow(
                        date=period_end,
                        description=income_override.description if income_override else "Projected investment income",
                        type="investment_income",
                        investment_income_amount=income,
                        running_balance=money(balance),
                        override_id=income_override.id if income_override else None,
                    )
                )
        current_month = add_months(current_month, 1)

    filtered = _filter_rows(rows, description, row_type)
    if grouping and grouping != "none":
        return RegistryResponse(groups=_group_rows(filtered, grouping))

    return RegistryResponse(rows=_sort_rows(filtered, sort))


def _filter_rows(
    rows: list[RegistryRow],
    description: str | None,
    row_type: str | None,
) -> list[RegistryRow]:
    result = rows
    if description:
        needle = description.lower()
        result = [row for row in result if needle in row.description.lower()]
    if row_type:
        result = [row for row in result if row.type == row_type]
    return result


def _sort_rows(rows: list[RegistryRow], sort: str) -> list[RegistryRow]:
    if sort == "date_asc":
        return sorted(rows, key=lambda row: (row.date, row.description))
    if sort == "deposit":
        return sorted(rows, key=lambda row: row.deposit_amount, reverse=True)
    if sort == "expense":
        return sorted(rows, key=lambda row: row.expense_amount, reverse=True)
    if sort == "description":
        return sorted(rows, key=lambda row: row.description.lower())
    return sorted(rows, key=lambda row: (row.date, row.description), reverse=True)


def _period_key(value: date, grouping: str) -> str:
    if grouping == "year":
        return str(value.year)
    if grouping == "quarter":
        quarter = ((value.month - 1) // 3) + 1
        return f"Q{quarter} {value.year}"
    return value.strftime("%b %Y")


def _group_rows(rows: list[RegistryRow], grouping: str) -> list[RegistryGroup]:
    buckets: dict[str, list[RegistryRow]] = defaultdict(list)
    for row in rows:
        buckets[_period_key(row.date, grouping)].append(row)

    groups = []
    for period, period_rows in buckets.items():
        ordered = sorted(period_rows, key=lambda row: row.date)
        groups.append(
            RegistryGroup(
                period=period,
                total_deposits=money(sum((row.deposit_amount for row in period_rows), Decimal("0"))),
                total_expenses=money(sum((row.expense_amount for row in period_rows), Decimal("0"))),
                total_investment_income=money(
                    sum((row.investment_income_amount for row in period_rows), Decimal("0"))
                ),
                ending_balance=ordered[-1].running_balance,
            )
        )
    return list(reversed(groups))
