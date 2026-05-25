from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from typing import NamedTuple

from app.models import ScheduleFrequency
from app.services.dates import add_months


class Occurrence(NamedTuple):
    date: date
    amount: Decimal
    description: str
    source_schedule_id: int | None


def _clamped_date(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, monthrange(year, month)[1]))


def _iter_months(start: date, end: date, step: int = 1):
    current = date(start.year, start.month, 1)
    last = date(end.year, end.month, 1)
    while current <= last:
        yield current
        current = add_months(current, step)


def expand_schedule(schedule, range_start: date, range_end: date) -> list[Occurrence]:
    start = max(schedule.start_date, range_start)
    end = min(schedule.end_date, range_end)
    if start > end:
        return []

    frequency = schedule.frequency
    recurrence = schedule.recurrence or {}
    rows: list[Occurrence] = []

    def add_if_visible(occurs_on: date) -> None:
        if schedule.start_date <= occurs_on <= schedule.end_date and range_start <= occurs_on <= range_end:
            rows.append(
                Occurrence(
                    date=occurs_on,
                    amount=schedule.amount,
                    description=schedule.description,
                    source_schedule_id=schedule.id,
                )
            )

    if frequency == ScheduleFrequency.MONTHLY:
        day = int(recurrence.get("day", schedule.start_date.day))
        for month in _iter_months(schedule.start_date, end):
            add_if_visible(_clamped_date(month.year, month.month, day))
    elif frequency == ScheduleFrequency.EVERY_TWO_WEEKS:
        current = schedule.start_date
        while current < range_start:
            current += timedelta(days=14)
        while current <= end:
            add_if_visible(current)
            current += timedelta(days=14)
    elif frequency == ScheduleFrequency.SEMI_MONTHLY:
        days = recurrence.get("days") or [1, 15]
        for month in _iter_months(schedule.start_date, end):
            for day in sorted({int(item) for item in days}):
                add_if_visible(_clamped_date(month.year, month.month, day))
    elif frequency == ScheduleFrequency.QUARTERLY:
        day = int(recurrence.get("day", schedule.start_date.day))
        current = schedule.start_date
        while current <= end:
            add_if_visible(_clamped_date(current.year, current.month, day))
            current = add_months(current, 3)
    elif frequency == ScheduleFrequency.YEARLY:
        month = int(recurrence.get("month", schedule.start_date.month))
        day = int(recurrence.get("day", schedule.start_date.day))
        for year in range(schedule.start_date.year, end.year + 1):
            add_if_visible(_clamped_date(year, month, day))
    elif frequency == ScheduleFrequency.SEMI_YEARLY:
        months = recurrence.get("months") or [schedule.start_date.month, add_months(schedule.start_date, 6).month]
        day = int(recurrence.get("day", schedule.start_date.day))
        for year in range(schedule.start_date.year, end.year + 1):
            for month in sorted({int(item) for item in months}):
                add_if_visible(_clamped_date(year, month, day))

    return sorted(rows, key=lambda row: row.date)
