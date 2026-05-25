from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from app.models import ScheduleFrequency
from app.services.dates import default_college_end_date
from app.services.recurrence import expand_schedule


def schedule(frequency, **recurrence):
    return SimpleNamespace(
        id=1,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        amount=Decimal("100.00"),
        description="Test",
        frequency=frequency,
        recurrence=recurrence,
    )


def test_default_college_end_date_is_45_months_after_start():
    assert default_college_end_date(date(2026, 8, 31)) == date(2030, 5, 31)


def test_monthly_recurrence_expands():
    rows = expand_schedule(schedule(ScheduleFrequency.MONTHLY), date(2026, 1, 1), date(2026, 3, 31))
    assert [row.date for row in rows] == [date(2026, 1, 1), date(2026, 2, 1), date(2026, 3, 1)]


def test_every_two_weeks_recurrence_expands():
    rows = expand_schedule(
        schedule(ScheduleFrequency.EVERY_TWO_WEEKS),
        date(2026, 1, 1),
        date(2026, 1, 31),
    )
    assert [row.date for row in rows] == [date(2026, 1, 1), date(2026, 1, 15), date(2026, 1, 29)]


def test_semi_monthly_defaults_to_first_and_fifteenth():
    rows = expand_schedule(
        schedule(ScheduleFrequency.SEMI_MONTHLY),
        date(2026, 2, 1),
        date(2026, 2, 28),
    )
    assert [row.date for row in rows] == [date(2026, 2, 1), date(2026, 2, 15)]


def test_quarterly_recurrence_expands():
    rows = expand_schedule(schedule(ScheduleFrequency.QUARTERLY), date(2026, 1, 1), date(2026, 7, 31))
    assert [row.date for row in rows] == [date(2026, 1, 1), date(2026, 4, 1), date(2026, 7, 1)]


def test_yearly_recurrence_expands():
    rows = expand_schedule(schedule(ScheduleFrequency.YEARLY, month=8, day=15), date(2026, 1, 1), date(2026, 12, 31))
    assert [row.date for row in rows] == [date(2026, 8, 15)]


def test_semi_yearly_uses_explicit_months():
    rows = expand_schedule(
        schedule(ScheduleFrequency.SEMI_YEARLY, months=[1, 8], day=10),
        date(2026, 1, 1),
        date(2026, 12, 31),
    )
    assert [row.date for row in rows] == [date(2026, 1, 10), date(2026, 8, 10)]
