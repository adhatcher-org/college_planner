# College Planner High-Level Design

## Overview

College Planner is a web application for planning and tracking college savings for one or more children. Users define college timelines, savings deposits, expected expenses, and investment return assumptions. The application produces a projected registry showing deposits, expenses, investment income, and running balances over time.

The application also includes an AI-assisted planning endpoint. Ollama generates the plan commentary, while the Brave Search API supplies cited source material when the user does not know what cost to plan for. This flow is currently backend-only; there is no forecast UI.

## Goals

- Help users understand whether they are on track to pay for college.
- Support multiple children per user.
- Support flexible recurring deposits and expenses.
- Produce a clear monthly account registry with projected balances.
- Provide forecast assistance without storing sensitive transient income values.
- Run cleanly in Docker on an Unraid server.
- Provide metrics and logs for an existing Prometheus, Grafana, Loki, and Promtail stack.

## Non-Goals

- Direct bank account synchronization.
- Payment processing.
- Tax advice.
- Investment advice beyond configurable expected return assumptions.
- Multi-household collaboration in the initial version.
- Persisting every projected future ledger row.

## System Architecture

```text
Browser
  |
  | HTTPS/HTTP
  v
FastAPI Backend
  |- serves the built React bundle from app/static
  |- serves the JSON API under /api
  |
  | SQL
  v
PostgreSQL

FastAPI Backend -> SMTP Server
FastAPI Backend -> Ollama
FastAPI Backend -> Brave Search API
Prometheus -> FastAPI /metrics
Promtail -> /logs
```

The backend serves the API and owns all financial calculations. The frontend presents workflows and calls the API. PostgreSQL stores durable user, child, schedule, and forecast data.

The container image builds the React bundle and copies it to `backend/app/static`, which FastAPI mounts at `/` when the directory exists. A deployed stack is therefore a single application container on one port. In local development the Vite dev server runs separately on port 5173 and proxies `/api`, `/health`, and `/metrics` to the backend on port 8000.

## Runtime Components

### Frontend

The frontend is a React 19 application built with Vite. The whole planner lives in one module, `frontend/src/main.tsx`, which exports the components (`App`, `AuthShell`, `PlannerApp`, `AccountSettings`, `ChildForm`, `ChildList`, `SchedulePanel`, `ScheduleList`, `BalanceAdjustmentPanel`, `AvailableFundsChart`, `RegistryTable`) rather than splitting them across feature directories.

It provides:

- Sign in, register, and request/confirm password reset
- Child management in the sidebar: create from first name, college start date, and initial savings; inline edit of name, both college dates, initial balance, and expected return rate; delete with confirmation
- Deposit and expense schedule management, split into an add/edit form section and a recurring-schedule list section launched from the sidebar
- Registry table with filters, grouping, inline occurrence editing, and past-row collapsing
- An account totals strip and an "Available funds by month" SVG chart
- Account settings for profile, email, password, and account deletion

There is no forecast wizard screen. The `POST /api/forecast` endpoint has no UI caller.

### Backend

The backend is a FastAPI application. All routers are mounted under the `/api` prefix. It provides:

- Auth, account maintenance, and password reset APIs (`/api/auth`)
- User-scoped child and account APIs (`/api/children`)
- Deposit and expense schedule APIs, including single-occurrence overrides (`/api/schedules`)
- Registry projection API, plus opening-balance, balance-adjustment, and investment-income-override APIs (`/api/registry`)
- Forecasting API (`/api/forecast`)
- Metrics endpoint (`/metrics`, unprefixed)
- Health endpoint (`/health`, unprefixed)
- Structured logging

### Database

PostgreSQL stores durable application state:

- Users
- Children
- College accounts
- Deposit schedules
- Expense schedules
- Balance adjustments
- Schedule occurrence overrides
- Investment income overrides
- Saved forecast scenarios
- Password reset tokens

Projected ledger rows are generated on demand and are not stored as the system of record. Adjustments and overrides are the durable exceptions layered on top of the projection; they record a correction to a specific date, not a full ledger.

### External Integrations

- SMTP sends password reset emails. When `SMTP_HOST` is unset the token is logged instead and no mail is sent.
- Ollama generates the forecast commentary. When it is unconfigured or fails, the backend falls back to a deterministic commentary string.
- Brave Search API supplies cited source material for college-cost lookups.
- Prometheus scrapes `/metrics`.
- Promtail scrapes files from `/logs`.

## Domain Model

### User

A user represents an application account.

Fields:

- Email
- First name
- Last name
- Password hash
- Role
- Force password reset flag
- Created timestamp
- Updated timestamp

The email address is the login identifier.

### Child

A child represents a college planning subject owned by a user.

Fields:

- Owner user id
- First name
- College start date
- College end date
- Created timestamp
- Updated timestamp

If no college end date is provided, default it to 45 months after the start date.

### College Account

A college account belongs to one child and contains the planning balance assumptions for that child.

Fields:

- Child id
- Initial balance
- Expected annual return rate
- Created timestamp
- Updated timestamp

The default expected annual return rate is 6%.

### Deposit Schedule

A deposit schedule describes recurring or planned savings contributions.

Fields:

- Account id
- Start date
- End date
- Amount
- Description
- Frequency
- Recurrence details (a JSON object)

Supported frequencies:

- One time
- Monthly
- Every two weeks
- Semi-monthly
- Quarterly
- Yearly
- Semi-yearly

Semi-monthly schedules support explicit days of the month through `recurrence.days` and default to the 1st and 15th.

Semi-yearly schedules support explicit months through `recurrence.months`, such as January and August.

One-time schedules occur on their start date only; the API forces the end date to equal the start date.

### Expense Schedule

An expense schedule describes future college costs.

Fields:

- Account id
- Start date
- End date
- Amount
- Description
- Frequency
- Recurrence details (a JSON object)

Deposits and expenses share one `ScheduleFrequency` enumeration and one recurrence expansion routine, so an expense supports the same frequency set as a deposit, including one time, every two weeks, semi-monthly, and quarterly. The UI offers the full list for both.

### Balance Adjustment

A balance adjustment records an actual observed account balance on a date. During projection it replaces the running balance instead of adding to it, so a plan can be re-anchored to reality without editing schedule history.

Fields:

- Account id
- Adjustment date
- Balance
- Description, defaulting to "Actual balance adjustment"
- Created timestamp
- Updated timestamp

### Schedule Occurrence Override

A schedule occurrence override edits, moves, or deletes a single projected occurrence of a schedule without changing the schedule itself.

Fields:

- Account id
- Schedule kind: deposit or expense
- Schedule id
- Original date, the date the schedule would have produced
- Override date, the date the occurrence should land on
- Amount
- Description, optional
- Deleted flag
- Created timestamp
- Updated timestamp

Overrides are keyed on account, schedule kind, schedule id, and original date, and are upserted.

### Investment Income Override

An investment income override replaces or suppresses the projected investment income row for one month end.

Fields:

- Account id
- Income date, the month end the row lands on
- Amount
- Description, defaulting to "Projected investment income"
- Deleted flag
- Created timestamp
- Updated timestamp

### Forecast Scenario

A forecast scenario stores non-sensitive forecast inputs and generated outputs.

Fields:

- Account id
- Yearly college cost assumption
- Existing savings amount
- One-time contribution assumptions (a JSON list)
- Yearly contribution amount
- Expected annual return rate
- Recommended monthly contribution
- User-selected monthly contribution
- Projected shortfall
- Generated commentary
- Citation metadata when web search is used
- Created timestamp

Income values used to estimate college cost must not be persisted. The forecast request accepts a `transient_income` field that is used only for the request and is never written to the scenario row.

## Registry Projection Design

The registry is a projection generated from:

- Account opening balance
- Deposit schedules
- Expense schedules
- Schedule occurrence overrides
- Balance adjustments
- Investment income overrides
- Expected annual return rate
- Requested date range

Projection steps:

1. Load the account, its schedules, occurrence overrides, balance adjustments, and investment income overrides.
2. Expand deposit and expense schedules into dated projected rows, then apply occurrence overrides, which can move a row's date, change its amount or description, or drop it entirely.
3. Append a row for each balance adjustment in range.
4. Walk the range month by month in chronological order, applying each month's rows to the running balance and then appending that month's investment income row.
5. Assign each emitted row a `ledger_sequence` reflecting the order in which it was applied to the balance.
6. Derive the plan status from the chronological rows.
7. Apply the display start cutoff, then description and row-type filters.
8. Return either sorted rows or grouped summaries to the frontend.

Balance calculations are always performed chronologically before display sorting. The API's default `sort` is `date_asc`, and the registry table exposes a toggle between `date_asc` and `date_desc`; `deposit`, `expense`, and `description` sorts are also accepted. Because balances are computed before sorting, `ledger_sequence` is what preserves the true application order when rows share a date.

A row carries a single signed `amount` rather than separate deposit, expense, and investment income columns. Expenses are negative. Opening balance and balance adjustment rows carry an amount of zero; a balance adjustment sets the running balance directly.

### Plan Status

Every registry response includes a `plan_status` of `Successful`, `Loans Required`, or `Short Fall`, derived from the chronological rows:

- `Loans Required` when the running balance at the first expense is at or below zero.
- `Short Fall` when the balance goes negative between the first and last expense, or when there are no expenses but some balance is negative.
- `Successful` otherwise.

### Display Start Date

`display_start_date` hides rows before a chosen date without changing the balances, so a user can look at the remaining plan while the running balance still reflects everything that came before. It is applied after balances are computed and before filtering and grouping.

## Investment Income

Convert annual return to an effective monthly rate:

```text
monthly_rate = (1 + annual_rate) ^ (1 / 12) - 1
```

At the end of each projected month, calculate investment income from the balance after that month's rows have been applied, and add it as a registry row. The default annual return is 6%, but users can change it per account or forecast scenario.

Three details apply:

- Income is calculated from `max(balance, 0)`, so a negative balance accrues no income and no negative income row is emitted.
- If the requested range starts mid-month, that first partial month emits no income row unless an override exists for it.
- An investment income override for a month end replaces the calculated amount and description, or suppresses the row when its deleted flag is set.

## Registry Grouping

Supported grouping modes:

- None
- Month
- Quarter
- Year

Grouped summaries include:

- Time period, formatted as `May 2026`, `Q2 2026`, or `2026`
- Whether the period is partial, meaning the display start date fell inside it
- Total deposits
- Total expenses
- Total investment income
- Ending account balance

Groups are returned in ascending period order.

## Authentication And Authorization

The first version uses private per-user data. A user can access only their own children, accounts, schedules, forecasts, and registry projections. Ownership is enforced by resolving an account through its child's `owner_id` on every account-scoped route, and by filtering children on `owner_id`.

Authentication is a bearer JWT signed with HS256 using `APP_SECRET_KEY`. The token subject is the user id and it expires after 24 hours by default. The frontend stores it in `localStorage` under `collegePlannerToken`. Passwords are hashed with `pwdlib`'s recommended scheme, Argon2.

The app bootstraps a default admin account on startup. The initial default admin password is `ChangeM3!` unless overridden by environment configuration. The admin is flagged for a required password reset, and the login response returns `force_password_reset` so a client can react to it. The backend exposes `POST /api/auth/force-password-reset`, but the current frontend does not yet gate the session on that flag; a bootstrapped admin can reach the planner and change the password from account settings.

Password reset uses expiring tokens, hashed at rest and valid for 30 minutes by default. The token is emailed as text through SMTP and the user pastes it back into the reset form; there is no reset link or dedicated reset page.

Account maintenance is also available to a signed-in user: update profile names, change the account email (requires the current password), change the password, and delete the account along with all owned children and account data.

## Forecasting Assistant

The forecasting assistant is a single stateless call, `POST /api/forecast`, not a multi-step server-side conversation. The caller supplies the account id and whatever assumptions it has, and the response contains the resolved yearly cost, the recommended and selected monthly contributions, the projected shortfall, commentary, and any citations. Each call persists a `ForecastScenario` row.

The endpoint:

- Accepts an explicit yearly college cost, or `use_search_estimate` when the caller does not have one.
- Calls the Brave Search API for the estimate path and returns the top three results as citations. It does not yet parse a cost out of those results; the estimate currently falls back to a fixed `30000.00` placeholder. This is the main gap against ADR-0003.
- Rejects the request with a 400 when no cost is supplied and either search is disabled or `BRAVE_SEARCH_API_KEY` is unset, which is the documented "ask the user to enter a cost manually" path.
- Accepts existing savings, a yearly contribution, one-time contributions, and an expected annual return rate. One-time contributions are persisted on the scenario but are not yet applied to the projection math.
- Accepts `transient_income`, which is neither persisted nor logged.
- Solves for the recommended monthly contribution by bisection over the future-value projection to the college start date.
- Accepts a user-selected monthly contribution and returns the resulting projected shortfall.
- Asks Ollama for commentary, falling back to a deterministic generated summary when Ollama is unconfigured or the call fails.

Deterministic financial calculations are performed by backend code, not by the language model.

There is currently no frontend for this endpoint.

## Observability

The application exposes:

- `GET /health`
- `GET /metrics`

`/metrics` currently publishes the default `prometheus_client` collectors plus two application series:

- `http_requests_total`, a counter labeled by method, path, and status.
- `http_request_duration_seconds`, a histogram labeled by method and path.

Both are recorded by an HTTP middleware that also emits the per-request log line and echoes an `x-request-id` response header, reusing an inbound `x-request-id` when present.

Logs are:

- Written to stdout for Docker logs.
- Written to `LOG_DIR` (default `/logs`) as `college-planner.log`, rotating at 5 MB with 5 backups, for Promtail scraping. If the directory cannot be created the app warns and continues with stdout logging only.
- Emitted as single-line JSON carrying level, logger, message, and, where present, request id, method, path, status code, duration in milliseconds, and error type.

Logs must not contain secrets, passwords, tokens, API keys, or transient income values.

## Deployment

The app is deployed with Docker Compose.

Compose includes:

- Application container
- PostgreSQL container

Both services read `.env`, which is optional at compose level so the stack still starts from defaults. Both restart `unless-stopped` and both declare health checks; the app waits on the database health check before starting.

External services are configured by environment variable:

- SMTP server
- Ollama endpoint
- Brave Search API
- Prometheus
- Loki/Promtail

The application container publishes `APP_PORT` (default 8000) to the container's port 8000 and mounts `APP_LOG_HOST_PATH` (default `./logs`) at `/logs`. PostgreSQL stores data in the named volume `postgres-data`.

The image is multi-stage: a Node stage builds the React bundle, and the `uv` Python stage installs backend dependencies with `uv sync --frozen --no-dev` and copies the bundle to `app/static`. It runs as a non-root `app` user and its start command is `uv run alembic upgrade head && uv run uvicorn app.main:app`, so migrations are applied on every container start. The application's own startup lifespan additionally calls `Base.metadata.create_all` and an additive SQLite-only runtime schema fix, which is what makes a fresh local SQLite checkout work without running Alembic.

## Operational Interface

Use a Makefile for common operations:

- Install dependencies
- Update dependencies
- Build
- Test
- Coverage
- Lint
- Typecheck
- Format
- Security scans
- Dependency lock and audit check
- PR check
- Docker image build
- Docker Compose up/down
- Local development run
- Clean generated artifacts

`make check` runs the full gate in the order CI runs it: frozen installs, lint, typecheck, test, coverage, security, dependency-check, pr-check, and a Docker build.

All Python commands should use `uv`.

