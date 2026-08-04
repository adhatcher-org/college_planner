from datetime import date
from decimal import Decimal

from app.models import (
    BalanceAdjustment,
    Child,
    CollegeAccount,
    DepositSchedule,
    ExpenseSchedule,
    InvestmentIncomeOverride,
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


def test_registry_groups_are_ordered_by_period_ascending(db_session):
    user = User(
        email="grouping@example.com",
        first_name="Grouping",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Casey",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.00"))
    account.deposit_schedules.append(
        DepositSchedule(
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            amount=Decimal("100.00"),
            description="Annual deposit",
            frequency=ScheduleFrequency.YEARLY,
            recurrence={},
        )
    )
    db_session.add(user)
    db_session.commit()

    for grouping, periods in (
        ("month", ["Jan 2026", "Jan 2027"]),
        ("quarter", ["Q1 2026", "Q1 2027"]),
        ("year", ["2026", "2027"]),
    ):
        response = project_registry(
            db_session,
            account,
            date(2026, 1, 1),
            date(2027, 1, 1),
            grouping=grouping,
        )
        assert [group.period for group in response.groups] == periods


def test_display_start_date_preserves_balances_and_plan_status(db_session):
    account = _account_with_expenses(
        db_session,
        Decimal("1000.00"),
        [
            (date(2026, 1, 1), Decimal("200.00")),
            (date(2026, 2, 1), Decimal("900.00")),
        ],
    )

    full = project_registry(db_session, account, date(2026, 1, 1), date(2026, 2, 28))
    before_range = project_registry(
        db_session,
        account,
        date(2026, 1, 1),
        date(2026, 2, 28),
        display_start_date=date(2025, 1, 1),
    )
    cutoff = project_registry(
        db_session,
        account,
        date(2026, 1, 1),
        date(2026, 2, 28),
        display_start_date=date(2026, 2, 1),
    )
    after_range = project_registry(
        db_session,
        account,
        date(2026, 1, 1),
        date(2026, 2, 28),
        display_start_date=date(2027, 1, 1),
    )

    assert before_range.rows == full.rows
    assert cutoff.plan_status == full.plan_status == "Short Fall"
    assert [row.description for row in cutoff.rows] == ["Expense 2026-02-01"]
    assert cutoff.rows[0].running_balance == Decimal("-100.00")
    assert after_range.rows == []
    assert after_range.plan_status == full.plan_status


def test_ledger_sequence_follows_balance_application_for_same_date_rows(db_session):
    user = User(
        email="sequence@example.com",
        first_name="Sequence",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Sequence",
        college_start_date=date(2026, 1, 1),
        college_end_date=date(2026, 1, 31),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("100.00"), expected_annual_return_rate=Decimal("0.00"))
    account.deposit_schedules.append(
        DepositSchedule(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 1),
            amount=Decimal("50.00"),
            description="Deposit",
            frequency=ScheduleFrequency.ONE_TIME,
            recurrence={},
        )
    )
    account.expense_schedules.append(
        ExpenseSchedule(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 1),
            amount=Decimal("20.00"),
            description="Expense",
            frequency=ScheduleFrequency.ONE_TIME,
            recurrence={},
        )
    )
    db_session.add(user)
    db_session.commit()
    db_session.add(
        BalanceAdjustment(
            account_id=account.id,
            adjustment_date=date(2026, 1, 1),
            balance=Decimal("75.00"),
            description="Actual balance",
        )
    )
    db_session.add(
        InvestmentIncomeOverride(
            account_id=account.id,
            income_date=date(2026, 1, 31),
            amount=Decimal("5.00"),
            description="Actual income",
        )
    )
    db_session.commit()

    ascending = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))
    descending = project_registry(
        db_session,
        account,
        date(2026, 1, 1),
        date(2026, 1, 31),
        sort="date_desc",
    )

    assert [row.ledger_sequence for row in ascending.rows] == [1, 2, 3, 4, 5]
    assert [row.running_balance for row in ascending.rows] == [
        Decimal("100.00"),
        Decimal("150.00"),
        Decimal("130.00"),
        Decimal("75.00"),
        Decimal("80.00"),
    ]
    assert [row.ledger_sequence for row in descending.rows] == [5, 4, 3, 2, 1]


def test_grouped_display_cutoff_marks_only_actual_partial_periods(db_session):
    user = User(
        email="partial@example.com",
        first_name="Partial",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Partial",
        college_start_date=date(2026, 1, 1),
        college_end_date=date(2026, 3, 31),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.00"))
    account.deposit_schedules.append(
        DepositSchedule(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            amount=Decimal("100.00"),
            description="Twice monthly",
            frequency=ScheduleFrequency.SEMI_MONTHLY,
            recurrence={"days": [1, 15]},
        )
    )
    db_session.add(user)
    db_session.commit()

    for grouping in ("month", "quarter", "year"):
        response = project_registry(
            db_session,
            account,
            date(2026, 1, 1),
            date(2026, 3, 31),
            display_start_date=date(2026, 2, 10),
            grouping=grouping,
        )
        assert response.groups[0].is_partial_period is True

    month = project_registry(
        db_session,
        account,
        date(2026, 1, 1),
        date(2026, 3, 31),
        display_start_date=date(2026, 2, 10),
        grouping="month",
    )
    assert month.groups[0].period == "Feb 2026"
    assert month.groups[0].total_deposits == Decimal("100.00")
    assert month.groups[0].ending_balance == Decimal("1400.00")
    assert month.groups[1].is_partial_period is False

    for grouping, cutoff in (
        ("month", date(2026, 2, 1)),
        ("quarter", date(2026, 1, 1)),
        ("year", date(2026, 1, 1)),
    ):
        response = project_registry(
            db_session,
            account,
            date(2026, 1, 1),
            date(2026, 3, 31),
            display_start_date=cutoff,
            grouping=grouping,
        )
        assert response.groups[0].is_partial_period is False


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
    assert adjusted[0].amount == Decimal("-5300.00")
    assert adjusted[0].original_date == date(2027, 8, 1)
    assert adjusted[0].date == date(2026, 12, 20)


def test_registry_applies_investment_income_overrides(db_session):
    user = User(
        email="third@example.com",
        first_name="Third",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Jordan",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.06"))
    db_session.add(user)
    db_session.commit()

    db_session.add(
        InvestmentIncomeOverride(
            account_id=account.id,
            income_date=date(2026, 1, 31),
            amount=Decimal("25.00"),
            description="Actual January income",
        )
    )
    db_session.commit()

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))
    income_rows = [row for row in response.rows if row.type == "investment_income"]
    assert income_rows[0].description == "Actual January income"
    assert income_rows[0].amount == Decimal("25.00")
    assert income_rows[0].running_balance == Decimal("1025.00")


def test_registry_skips_projected_income_for_partial_start_month(db_session):
    user = User(
        email="partial@example.com",
        first_name="Partial",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Morgan",
        college_start_date=date(2026, 5, 28),
        college_end_date=date(2026, 6, 30),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.06"))
    db_session.add(user)
    db_session.commit()

    response = project_registry(db_session, account, date(2026, 5, 28), date(2026, 6, 30))

    income_rows = [row for row in response.rows if row.type == "investment_income"]
    assert [row.date for row in income_rows] == [date(2026, 6, 30)]
    assert response.rows[0].date == date(2026, 5, 28)
    assert response.rows[0].running_balance == Decimal("1000.00")


def test_registry_skips_deleted_occurrences_and_income(db_session):
    user = User(
        email="fourth@example.com",
        first_name="Fourth",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Taylor",
        college_start_date=date(2030, 8, 1),
        college_end_date=date(2034, 5, 1),
    )
    account = CollegeAccount(child=child, initial_balance=Decimal("1000.00"), expected_annual_return_rate=Decimal("0.06"))
    deposit = DepositSchedule(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        amount=Decimal("100.00"),
        description="Deposit",
        frequency=ScheduleFrequency.MONTHLY,
        recurrence={},
    )
    account.deposit_schedules.append(deposit)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(deposit)

    db_session.add(
        ScheduleOccurrenceOverride(
            account_id=account.id,
            schedule_kind=ScheduleKind.DEPOSIT,
            schedule_id=deposit.id,
            original_date=date(2026, 1, 1),
            override_date=date(2026, 1, 1),
            amount=Decimal("0.00"),
            description="Deleted deposit",
            is_deleted=True,
        )
    )
    db_session.add(
        InvestmentIncomeOverride(
            account_id=account.id,
            income_date=date(2026, 1, 31),
            amount=Decimal("0.00"),
            description="Deleted income",
            is_deleted=True,
        )
    )
    db_session.commit()

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))
    assert not any(row.type == "deposit" for row in response.rows)
    assert not any(row.type == "investment_income" for row in response.rows)


def test_registry_plan_status_successful(db_session):
    account = _account_with_expenses(db_session, Decimal("1000.00"), [(date(2026, 1, 1), Decimal("200.00"))])

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))

    assert response.plan_status == "Successful"


def test_registry_plan_status_loans_required_when_first_expense_is_not_covered(db_session):
    account = _account_with_expenses(db_session, Decimal("100.00"), [(date(2026, 1, 1), Decimal("200.00"))])

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))

    assert response.plan_status == "Loans Required"


def test_registry_plan_status_loans_required_when_never_positive_after_first_expense(db_session):
    account = _account_with_expenses(db_session, Decimal("100.00"), [(date(2026, 1, 1), Decimal("100.00"))])

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 1, 31))

    assert response.plan_status == "Loans Required"


def test_registry_plan_status_short_fall_after_positive_first_expense(db_session):
    account = _account_with_expenses(
        db_session,
        Decimal("1000.00"),
        [
            (date(2026, 1, 1), Decimal("200.00")),
            (date(2026, 2, 1), Decimal("900.00")),
            (date(2026, 3, 1), Decimal("100.00")),
        ],
    )

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 3, 31))

    assert response.plan_status == "Short Fall"


def test_registry_plan_status_short_fall_when_final_expense_goes_negative(db_session):
    account = _account_with_expenses(
        db_session,
        Decimal("1000.00"),
        [
            (date(2026, 1, 1), Decimal("200.00")),
            (date(2026, 2, 1), Decimal("900.00")),
        ],
    )

    response = project_registry(db_session, account, date(2026, 1, 1), date(2026, 2, 28))

    assert response.plan_status == "Short Fall"


def _account_with_expenses(
    db_session,
    initial_balance: Decimal,
    expenses: list[tuple[date, Decimal]],
) -> CollegeAccount:
    user = User(
        email=f"status-{len(expenses)}-{initial_balance}@example.com",
        first_name="Status",
        last_name="User",
        password_hash="hash",
        role=UserRole.USER,
    )
    child = Child(
        owner=user,
        first_name="Status",
        college_start_date=date(2026, 1, 1),
        college_end_date=date(2026, 12, 31),
    )
    account = CollegeAccount(child=child, initial_balance=initial_balance, expected_annual_return_rate=Decimal("0.00"))
    for expense_date, amount in expenses:
        account.expense_schedules.append(
            ExpenseSchedule(
                start_date=expense_date,
                end_date=expense_date,
                amount=amount,
                description=f"Expense {expense_date.isoformat()}",
                frequency=ScheduleFrequency.ONE_TIME,
                recurrence={},
            )
        )
    db_session.add(user)
    db_session.commit()
    return account
