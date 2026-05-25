# ADR-0002: Ledger Generation Model

## Status

Accepted

## Context

The application must show future account balances based on user-defined recurring deposits, recurring expenses, and expected investment income. Users can edit dates, amounts, frequencies, expected returns, and college timelines. If the app stores every projected future row as durable data, projections can become stale whenever assumptions change.

The registry must support filtering, sorting, and grouping by month, quarter, and year.

## Decision

Store schedules and account assumptions as the source of truth. Generate projected registry rows on demand for the requested account and date range.

Do not persist expanded future ledger rows as the authoritative data model.

## Rationale

On-demand projection keeps future balances consistent with the latest schedules and assumptions. It avoids regeneration jobs and stale stored rows when a user changes a deposit, expense, college end date, initial balance, or return rate.

This model keeps the durable data small and focused:

- Child
- Account
- Deposit schedules
- Expense schedules
- Forecast settings

Projected rows are derived data and can be recalculated whenever needed.

## Consequences

- Registry calculation must be deterministic and well tested.
- Projection performance matters for long date ranges.
- Running balances must be calculated chronologically even when displayed in descending order.
- The backend must own recurrence expansion and investment income calculations.
- Caching can be added later if projection performance becomes a real problem.

## Implementation Notes

Projection input:

- Account id
- Date range
- Filters
- Grouping mode
- Sort options

Projection output:

- Ungrouped registry rows, or
- Grouped summaries for month, quarter, or year

Supported expense frequencies:

- Monthly
- Yearly
- Semi-yearly with explicit due months

Supported deposit frequencies:

- Monthly
- Every two weeks
- Semi-monthly with explicit days of month
- Quarterly
- Yearly
- Semi-yearly with explicit due months

Investment income:

- Convert annual return to an effective monthly rate.
- Add investment income as a projected monthly ledger row.
- Default annual return is 6%.

Semi-yearly schedules must not assume a six-month interval. They must store selected months explicitly.

