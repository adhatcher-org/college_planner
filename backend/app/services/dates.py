from calendar import monthrange
from datetime import date


def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def default_college_end_date(start_date: date) -> date:
    return add_months(start_date, 45)


def month_end(value: date) -> date:
    return date(value.year, value.month, monthrange(value.year, value.month)[1])
