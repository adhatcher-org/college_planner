from datetime import date
from decimal import Decimal

from app.models import (
    BalanceAdjustment,
    Child,
    CollegeAccount,
    DepositSchedule,
    ExpenseSchedule,
    ScheduleFrequency,
    ScheduleKind,
    ScheduleOccurrenceOverride,
    User,
    UserRole,
)
from app.services.registry import project_registry


def test_registry_projects_running_balance_and_groups(db_session):
    user = User(
        email="parent@example.com",
        first_name="Parent",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Avery",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.06"))
    account.deposit_schedules.append(
        DepositSchedule(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            amount=Decimal("100.00"),
            description="Monthly deposit",
            frequency=ScheduleFrequency.MONTHLY,
            recurrence={},
        )
    )
    account.expense_schedules.append(
        ExpenseSchedule(
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            amount=Decimal("50.00"),
            description="Fee",
            frequency=ScheduleFrequency.MONTHLY,
            recurrence={},
        )
    )
    db_session.add(user)
    db_session.commit()

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 3, 31))
    assert any(row.type == "investment_income" for row in response.rows)
    assert response.rows[0].date == date(2026, 1, 1)
    assert response.rows[-1].date == date(2026, 3, 31)

    grouped = project_registry(db_session, account, date(2026, 1, 1), date(2026, 3, 31), grouping="quarter")
    assert grouped.groups[0].period == "Q1 2026"
    assert grouped.groups[0].total_deposits == Decimal("300.00")
    assert grouped.groups[0].total_expenses == Decimal("50.00")


def test_registry_applies_balance_adjustments_and_occurrence_overrides(db_session):
    user = User(
        email="second@example.com",
        first_name="Second",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Riley",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.00"))
    expense = ExpenseSchedule(
        start_date=date(2026, 1, 1),
        end_date=date(2027, 12, 31),
        amount=Decimal("5000.00"),
        description="Tuition",
        frequency=ScheduleFrequency.SEMI_YEARLY,
        recurrence={"months": [1, 8], "day": 1},
    )
    account.expense_schedules.append(expense)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(expense)

    db_session.add(
        ScheduleOccurrenceOverride(
            account_id=account.id,
            schedule_kind=ScheduleKind.EXPENSE,
            schedule_id=expense.id,
            original_date=date(2027, 8, 1),
            override_date=date(2026, 12, 20),
            amount=Decimal("5300.00"),
            description="Adjusted tuition",
        )
    )
    db_session.add(
        BalanceAdjustment(
            account_id=account.id,
            adjustment_date=date(2026, 12, 21),
            balance=Decimal("2500.00"),
            description="Actual balance",
        )
    )
    db_session.commit()

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 12, 31))
    assert any(row.type == "balance_adjustment" and row.running_balance == Decimal("2500.00") for row in response.rows)
    adjusted = [row for row in response.rows if row.description == "Adjusted tuition"]
    assert adjusted[0].expense_amount == Decimal("5300.00")
    assert adjusted[0].original_date == date(2027, 8, 1)
    assert adjusted[0].date == date(2026, 12, 20)
