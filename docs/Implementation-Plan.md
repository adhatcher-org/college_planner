# College Planner Implementation Plan

## Purpose

Build a Dockerized web application that helps users plan, track, and forecast college savings for one or more children. The application supports child-specific savings accounts, scheduled deposits, scheduled expenses, expected investment income, a projected registry view, password-protected user accounts, observability, and AI-assisted forecasting through Ollama.

This document was written to be implementation-ready. The application has since been built, so each section now records the shape that was implemented and calls out the places where the plan and the code diverge.

## Success Criteria

- Done. A user can register, sign in, reset their password by email, and manage only their own data.
- Partial. A default admin user is created on startup and flagged for a forced reset, and the login response carries `force_password_reset`, but the frontend does not yet gate the session on that flag.
- Done. A user can create one or more children with college start and end dates.
- Done. Each child has an independent college savings account and projected balance.
- Done. A user can define recurring deposits and expenses with flexible recurrence rules.
- Done. The registry view shows projected deposits, expenses, investment income, and running balance.
- Done. The registry can be filtered and collapsed by month, quarter, or year.
- Partial. The forecast endpoint calculates a plan from user input, adds Ollama commentary, and attaches Brave Search citations, but it does not derive a cost from those results and has no frontend.
- Done. The application runs locally and on an Unraid server through Docker Compose.
- Done. Metrics are exposed at `/metrics`, and logs are written to `/logs`.
- Done. A Makefile provides standard build, test, lint, typecheck, coverage, security, dependency, PR-check, Docker, and local run commands.

## Architecture

The project uses a split frontend/backend source layout that ships as a single container:

- Backend: Python FastAPI, Python 3.12
- Python dependency management: uv
- Frontend: React 19 with Vite 8, built to static assets and served by the backend from `backend/app/static`
- Database: PostgreSQL in Docker; SQLite by default for local runs and tests
- Migrations: Alembic, applied by the container start command. The app's startup lifespan also runs `Base.metadata.create_all` plus an additive SQLite-only runtime schema fix so a fresh local checkout works without Alembic.
- Authentication: backend-managed email/password auth, Argon2 hashing through `pwdlib`, HS256 JWT bearer tokens
- Email: SMTP configured through environment variables
- Forecasting: Ollama HTTP API (`/api/generate`)
- Web search: Brave Search API
- Metrics: Prometheus-compatible `/metrics`
- Logging: structured JSON application logs written to stdout and `/logs`
- Runtime: Docker Compose

The backend owns all domain logic, recurrence expansion, projected ledger calculations, auth, observability, and external integrations. The frontend consumes backend APIs and provides the user workflows.

## Repository Structure

The project is laid out as follows:

```text
.
├── backend/
│   ├── app/
│   │   ├── api/          auth, children, schedules, registry, forecast, deps
│   │   ├── core/         config, logging, security
│   │   ├── db/           session, runtime schema fixes
│   │   ├── models/       domain.py, all SQLAlchemy models
│   │   ├── schemas/      domain.py, all Pydantic schemas
│   │   ├── services/     auth, dates, email, forecast, recurrence, registry
│   │   ├── static/       built frontend assets, created by the Docker build
│   │   └── main.py
│   ├── alembic/
│   │   └── versions/     0001_initial, 0002_bal_and_occ_overrides, 0003_inv_income
│   ├── tests/            conftest, test_api, test_recurrence, test_registry
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   ├── main.tsx      the entire planner UI
│   │   ├── main.test.tsx
│   │   ├── smoke.test.ts
│   │   ├── styles.css
│   │   └── test/setup.ts
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts    Vite config plus the Vitest config block
├── docs/
│   └── adr/
├── scripts/              pr_review.py, security_remediation_agent.py
├── .github/workflows/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
```

Vite is the React build tool, and Vitest is configured through the `test` block in `vite.config.ts` rather than a separate config file.

The frontend is deliberately a single module. `frontend/src/main.tsx` is about 2,600 lines and holds every component; the plan's per-feature component directories were never created. Anyone splitting it later should keep the component exports stable, because `frontend/src/main.test.tsx` imports `PlannerApp`, `AccountSettings`, `RegistryTable`, and `AvailableFundsChart` from it directly.

## Backend Implementation

### Configuration

`backend/app/core/config.py` defines these environment-driven settings:

- `APP_ENV`
- `APP_SECRET_KEY`
- `DATABASE_URL`, defaulting to `sqlite:///./college_planner.db`
- `ADMIN_EMAIL`
- `ADMIN_INITIAL_PASSWORD`, defaulting to `ChangeM3!`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `OLLAMA_BASE_URL`, unset by default
- `OLLAMA_MODEL`, defaulting to `llama3.1`
- `BRAVE_SEARCH_API_KEY`
- `BRAVE_SEARCH_BASE_URL`
- `LOG_DIR`, defaulting to `/logs`
- `CORS_ALLOWED_ORIGINS`, a comma-separated string parsed into a list
- `ACCESS_TOKEN_MINUTES`, defaulting to 1440
- `PASSWORD_RESET_MINUTES`, defaulting to 30

Compose reads three more variables that the backend never sees: `APP_PORT`, `APP_LOG_HOST_PATH`, and `POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` for the database service.

All sensitive values must be supplied through `.env` and must not be hardcoded in `docker-compose.yml`. `.env.example` carries placeholders for everything except `ACCESS_TOKEN_MINUTES` and `PASSWORD_RESET_MINUTES`, which are left at their defaults.

### Authentication And Users

Implemented:

- User registration with email, first name, last name, and a password of at least 8 characters.
- Login using email and password. Emails are normalized to lowercase everywhere.
- Password hashing with `pwdlib`'s `PasswordHash.recommended()`, which is Argon2.
- HS256 JWT bearer tokens carrying the user id as the subject, expiring after `ACCESS_TOKEN_MINUTES`. The frontend keeps the token in `localStorage` under `collegePlannerToken`.
- Password reset tokens generated with `secrets.token_urlsafe`, stored hashed, single-use, and expiring after `PASSWORD_RESET_MINUTES`. The reset request endpoint always returns the same 202 response so it does not disclose whether an account exists.
- Default admin bootstrap from environment settings on startup, idempotent on the admin email.
- Default admin password of `ChangeM3!` when not overridden.
- `POST /api/auth/force-password-reset`, and `force_password_reset` on the login response.

Also implemented beyond the original plan, under `/api/auth`: `GET /me`, `PATCH /me` for profile and email changes, `POST /change-password`, and `DELETE /me`, which cascades to the user's children, accounts, schedules, adjustments, overrides, and scenarios. Email changes and account deletion both require the current password.

Not yet implemented: the frontend does not force the bootstrapped admin through a reset before reaching the planner. The email itself carries the raw reset token as text rather than a reset link, and the user pastes it into the sign-in screen's reset form. When `SMTP_HOST` is empty the service logs that a token was created and sends nothing.

User data is private by default. A non-admin user can only access their own children, schedules, forecasts, and registry projections. There is no elevated behavior for the admin role beyond the bootstrap; `UserRole.ADMIN` is currently only a stored attribute.

### Domain Model

The core entities in `backend/app/models/domain.py` are:

- User
- Child
- CollegeAccount
- DepositSchedule
- ExpenseSchedule
- ForecastScenario
- BalanceAdjustment
- ScheduleOccurrenceOverride
- InvestmentIncomeOverride
- PasswordResetToken

There is no separate `ForecastSettings` entity. The expected annual return rate lives on `CollegeAccount`, and each forecast run persists its own assumptions on a `ForecastScenario` row. The three adjustment/override entities were added after this plan was written; the High-Level Design describes their fields and their role in projection.

Child fields:

- First name
- College start date
- College end date
- Owner user id

Default the college end date to 45 months after the college start date when the user does not provide an end date.

College account behavior:

- Create one account per child.
- Store current initial savings as an initial balance entry or account opening balance.
- Keep the account scoped to the child and owner user.

Schedule fields, shared by `DepositSchedule` and `ExpenseSchedule` through a mixin and stored in separate tables:

- Account id
- Start date
- End date
- Amount
- Description
- Frequency
- Recurrence details, a JSON object

Deposits and expenses are distinguished by table rather than by a `type` column, and both use the same `ScheduleFrequency` enumeration, so the full frequency set applies to each:

- One time, which occurs on the start date only; the API forces the end date to match
- Monthly, with an optional `recurrence.day`, defaulting to the start date's day
- Every two weeks, stepping 14 days from the start date
- Semi-monthly, with `recurrence.days` defaulting to the 1st and 15th
- Quarterly, stepping 3 months with an optional `recurrence.day`
- Yearly, with optional `recurrence.month` and `recurrence.day`
- Semi-yearly, with explicit `recurrence.months` and an optional `recurrence.day`

Days beyond the end of a short month are clamped to the last day of that month.

For semi-yearly schedules, never infer "every six months" as the only behavior. Store explicit due months, such as January and August. The UI defaults a new semi-yearly schedule to January and August, and a new semi-monthly schedule to the 1st and 15th.

### Registry And Ledger Projection

Schedules are the source of truth. Future ledger rows are not pre-created as persisted transactions.

`backend/app/services/registry.py` implements a projection service that:

- Accepts account id, date range, filters, a display start date, sort option, and grouping mode.
- Expands schedules into projected ledger rows for the requested date range.
- Applies schedule occurrence overrides, which can move a row's date, change its amount or description, or drop it.
- Applies balance adjustments, which set the running balance rather than adding to it.
- Calculates balances chronologically, month by month.
- Adds monthly investment income rows, honoring per-month investment income overrides.
- Derives a `plan_status` of `Successful`, `Loans Required`, or `Short Fall`.
- Returns rows sorted for display. The API's `sort` parameter defaults to `date_asc` and also accepts `date_desc`, `deposit`, `expense`, and `description`.
- Supports grouped summaries by month, quarter, and year, marking any group the display start date fell inside as partial.

Ledger row fields, as returned by `RegistryRow`:

- `ledger_sequence`, the order in which the row was applied to the running balance
- `date`
- `description`
- `type`: `deposit`, `expense`, `investment_income`, `opening_balance`, or `balance_adjustment`
- `amount`, a single signed value. Expenses are negative; opening balance and balance adjustment rows are zero.
- `running_balance`
- `source_schedule_id` and `source_schedule_kind` when applicable
- `original_date`, the date the schedule would have produced, when an occurrence was moved
- `override_id`, the id of the applied override or adjustment when one exists

The separate `deposit_amount`, `expense_amount`, and `investment_income_amount` fields in the original plan were consolidated into the single `amount` field.

Investment return:

- Store the expected annual return rate on the college account, and on each forecast scenario.
- Default to 6%.
- Convert the annual rate to an effective monthly compounding rate.
- At each month end, apply investment income from the balance after that month's rows, using `max(balance, 0)` so a negative balance accrues nothing.
- Skip the income row when the requested range starts mid-month, for that first partial month only, unless an override exists.
- Add investment income to the running balance as a projected ledger row.

Registry filtering, all applied after balances are computed:

- Date range, through the required `start_date` and `end_date`
- `display_start_date`, which hides earlier rows without changing balances
- `description`, a case-insensitive substring match
- `row_type`, which restricts to one of the row types

Amount filters were considered and not implemented. The registry table additionally collapses past rows client-side, keeping only the latest one visible behind an expander.

### Forecasting Assistant

The plan called for a guided, multi-step setup flow after creating a child. What exists is a single stateless endpoint, `POST /api/forecast`, that takes the whole set of assumptions at once and returns a complete result. The step sequencing was never built, and there is no UI.

`ForecastRequest` fields:

- `account_id`
- `yearly_college_cost`, optional
- `use_search_estimate`, defaulting to false
- `transient_income`, optional
- `existing_savings`
- `one_time_contributions`, a list
- `yearly_contribution`
- `expected_annual_return_rate`, defaulting to 6%
- `user_selected_monthly_contribution`, optional

Behavior against the original flow:

1. Not implemented as a step. The caller decides whether to invoke the endpoint.
2. Done. `yearly_college_cost` is used directly when supplied.
3. Partial. With `use_search_estimate` set and `BRAVE_SEARCH_API_KEY` configured, the backend queries Brave Search and returns the top three results as citations, but it does not parse a cost out of them. The estimate falls back to a fixed `30000.00` placeholder. Without a key, the request is rejected with a 400 telling the caller to enter a cost manually.
4. Partial. `transient_income` is accepted and is never persisted or logged, but nothing currently consumes it.
5. Done. `existing_savings` seeds the projection's opening balance.
6. Partial. `yearly_contribution` is applied to the projection. `one_time_contributions` is persisted on the scenario but is not applied to the math.
7. Done. `expected_annual_return_rate` defaults to 6%.
8. Done. The recommended monthly contribution is solved by 60-iteration bisection over the future-value projection from today to the college start date.
9. Done. `user_selected_monthly_contribution` overrides the recommendation; the recommendation is used when it is omitted.
10. Done. The shortfall is the projected gap between the target total and the future value at the selected contribution, floored at zero.

Ollama responsibilities, as implemented:

- Generate human-readable scenario commentary through `POST {OLLAMA_BASE_URL}/api/generate` with `stream: false`.
- The backend composes a deterministic summary string, sends it as the prompt, and returns that same string as the fallback when `OLLAMA_BASE_URL` is unset or the call raises an `httpx.HTTPError`.

Backend responsibilities, as implemented:

- Perform deterministic financial calculations.
- Store only non-sensitive planning inputs, on `ForecastScenario`.
- Keep transient income values out of persistence and logs.
- Attach citations when Brave Search is used.

Scenarios are written but never read back; there is no endpoint to list or retrieve a saved forecast.

### Observability

Implemented:

- `GET /metrics` for Prometheus scraping, returning `prometheus_client`'s default registry.
- Structured single-line JSON logs to stdout.
- The same JSON logs written to `LOG_DIR/college-planner.log`, rotating at 5 MB with 5 backups. A failure to create the log directory degrades to stdout-only with a warning.
- Request logging middleware recording method, path, status code, duration in milliseconds, and a request id, and echoing `x-request-id` on the response.
- Error logging that records only the exception type, without secrets or sensitive transient values.
- `GET /health` for Docker health checks, used by both the Dockerfile `HEALTHCHECK` and the Compose health check.

Metrics in place:

- `http_requests_total`, a counter labeled by method, path, and status, which covers both the request count and the response status count.
- `http_request_duration_seconds`, a histogram labeled by method and path.

Not implemented: forecast request count, forecast error count, registry projection latency, and database connection health.

Note that both metrics label on the raw request path, so paths carrying ids produce one label set per id.

## Frontend Implementation

The plan called for React components organized into Auth, Children, Schedules, Registry, Forecasting, and Settings directories. That structure was not built. Everything lives in `frontend/src/main.tsx` as one module, with the components exported from it so tests can mount them individually. There is no router; the app is a single screen whose regions are toggled by state.

Screens and regions that exist:

- `AuthShell`, covering sign in, register, request password reset, and confirm password reset with a pasted token. This is the whole unauthenticated surface; `App` chooses between it and `PlannerApp` based on the presence of a stored token.
- `PlannerApp`, the authenticated shell: a sidebar plus a workspace with the account totals strip, the funds chart, the optional schedule section, and the registry.
- `ChildForm` in the sidebar, which creates a child from first name, college start date, and initial savings, letting the backend default the end date.
- `ChildList` in the sidebar, which selects a child, edits name, both college dates, initial balance, and expected return rate inline, and deletes behind a `window.confirm`.
- `ScheduleSidebarNav`, which opens `SchedulePanel` in either its add/edit form mode or its recurring-schedule list mode.
- `BalanceAdjustmentPanel` in the sidebar, for recording an actual balance on a date.
- `AccountSettings` in the sidebar, covering profile, email, password, and account deletion.
- `AvailableFundsChart`, a hand-rolled SVG line chart of month-end balances with a zero baseline and negative-balance styling.
- `RegistryTable`.

Screens that do not exist: a separate dashboard, a forced password reset screen, and the forecast wizard.

Registry UI, as built:

- Shows ledger sequence, date, description, a single signed amount, and running balance. The three separate amount columns became one `Amount` column.
- Filters sit in a toolbar in the registry panel heading rather than in the table headers: display start date with Today and Clear shortcuts, grouping, row type, and a debounced description search.
- Supports grouping by none, month, quarter, and year.
- In grouped mode shows period, total deposits, total expenses, total investment income, and ending balance, and flags partial periods.
- Defaults to date ascending, with a header toggle to date descending. The plan's date-descending default was not adopted.
- Collapses past rows to the latest one behind an expander so the view opens near today.
- Supports inline editing of a row: an occurrence edit writes a schedule occurrence override, an investment income row writes an investment income override, a balance adjustment row patches the adjustment, and the opening balance row patches the account's initial balance.

Not implemented: preserving the selected child/account and filters in URL query parameters.

Forecast wizard UI: not implemented. `POST /api/forecast` has no frontend caller.

## Docker And Unraid Deployment

Create:

- `Dockerfile`
- `docker-compose.yml`
- `.env.example`

Docker Compose services:

- Application service
- PostgreSQL service

Optional external services expected to exist:

- Ollama
- Prometheus
- Grafana
- Loki
- Promtail

The app service does:

- Expose the web app port through `APP_PORT`, defaulting to 8000, mapped to the container's 8000.
- Mount `APP_LOG_HOST_PATH`, defaulting to `./logs`, at `/logs`.
- Use environment variables from `.env`, declared optional so the stack starts without one.
- Run `alembic upgrade head` in the container start command before launching uvicorn.
- Include a health check against `/health`, in both the Dockerfile and Compose, and wait on the database's health check before starting.
- Run as a non-root `app` user.
- Restart `unless-stopped`.

The PostgreSQL service does:

- Run `postgres:17-alpine`.
- Store data in the named volume `postgres-data`.
- Use credentials from `.env`.
- Avoid hardcoded passwords in Compose.
- Include a `pg_isready` health check and restart `unless-stopped`.

The Dockerfile is multi-stage: `node:26-alpine` builds the frontend with `npm ci && npm run build`, and `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` installs the backend with `uv sync --frozen --no-dev` and copies the built bundle into `app/static`.

Unraid notes live in README.md and cover:

- Required environment variables
- Port mappings
- Volume mappings
- Log path mapping
- PostgreSQL data volume
- Ollama URL
- Restart policy
- Prometheus scrape target
- Promtail log scrape path

## Makefile

The Makefile is the primary developer command surface.

Targets:

- `install`: `uv sync` in `backend/` and `npm install` in `frontend/`.
- `update`: `uv lock --upgrade` and `npm update`.
- `check`: the full aggregate gate, in the order CI runs it: `uv sync --frozen`, `npm ci`, then lint, typecheck, test, coverage, security, dependency-check, pr-check, and a `docker build`.
- `build`: Ruff check on the backend and `npm run build` for frontend production assets.
- `test`: `pytest` and `vitest run`.
- `coverage`: `pytest --cov=app` with term-missing and XML reports, and `vitest run --coverage`.
- `lint`: `ruff check app tests` and `eslint .`.
- `typecheck`: `tsc -b` for the frontend. There is no backend type checker.
- `format`: `ruff format`, `ruff check --fix`, and Prettier.
- `security`: `bandit -r app`, `pip-audit`, and `npm audit --audit-level=high`.
- `dependency-check`: `uv lock --check`, `uv sync --frozen`, and `pip-audit`.
- `pr-check`: `python3 scripts/pr_review.py`.
- `docker-build`: `docker compose build`.
- `docker-up`: `docker compose up -d`.
- `docker-down`: `docker compose down`.
- `run`: `uvicorn app.main:app --reload` on port 8000. This runs the API only; the Vite dev server is started separately with `npm run dev`.
- `clean`: remove generated build/test artifacts only.

Use `uv` for all Python dependency and command execution. Do not use pip directly in normal developer commands.

`.github/workflows/ci.yml` delegates to the shared `adhatcher-org/shared-workflows` `app-ci.yml`, enabling lint, typecheck, tests, coverage, security, dependency-check, PR check, and a Docker build. Those are the gates a change has to satisfy.

Backend tools in use:

- `ruff` for linting and formatting, line length 130, rule set `E`, `F`, `I`, `UP`, `B`
- `pytest` for tests
- `pytest-cov` for coverage
- `pip-audit` via `uv run` for Python dependency scanning
- `bandit` for Python security checks

Frontend tools in use:

- npm
- ESLint 10 with `typescript-eslint`, `eslint-plugin-react-hooks` v7 recommended rules, and `eslint-plugin-react-refresh`
- Prettier
- Vitest with jsdom and Testing Library
- `npm audit --audit-level=high`

## Testing Plan

Backend tests run against in-memory SQLite. `backend/tests/conftest.py` provides a `db_session` fixture that creates and drops the schema per test and bootstraps the admin, and a `client` fixture that overrides `get_db` on a fresh app instance.

Backend unit tests, in `test_recurrence.py` and `test_registry.py`:

- Done. One-time, monthly, yearly, quarterly, every-two-weeks, semi-monthly, and semi-yearly recurrence expansion, including semi-yearly with explicit months and an August start ahead of the next January.
- Done. Default child end date is 45 months after start date.
- Done. Running balance calculations, and `ledger_sequence` ordering for same-date rows.
- Done. Registry grouping by month, quarter, and year, ascending group order, and partial-period marking under a display cutoff.
- Done, beyond the original list. Balance adjustments, occurrence overrides, investment income overrides, deleted occurrences and income, the skipped partial first-month income row, and all four plan-status outcomes.
- Not covered directly. Monthly compounding return calculations are exercised only through registry assertions; `monthly_rate` has no test of its own.

Backend API tests, in `test_api.py`:

- Done. Register user, login user, bootstrap admin returning `force_password_reset`, create child with a defaulted end date, create a deposit schedule, and a registry query with a display start date asserting the consolidated `amount` field.
- Done, beyond the original list. Profile update, email change requiring the current password, duplicate-email rejection, password change, and account deletion cascading to child and account.
- Not covered. The `force-password-reset` endpoint, the password reset request/confirm flow, update and delete for children, update and delete for deposit and expense schedules, list endpoints, registry description filtering, and the cross-user access denial case.

Forecasting tests: none exist. There is no test file for `app/services/forecast.py` or `/api/forecast`, so none of the five listed cases is covered.

Frontend tests, in `main.test.tsx`, which mounts `PlannerApp`, `AccountSettings`, `RegistryTable`, and `AvailableFundsChart` with a stubbed `fetch`:

- Done. Registry load ordering, applying and clearing a display start date, description debouncing to one request, stale registry responses not overwriting a newer filter, graceful fallback when the balance-adjustments lookup fails, and deriving the registry range from the earliest schedule start.
- Done. Sidebar-launched schedule sections and the recurring-schedule edit handoff.
- Done. Past-row collapsing in both sort directions, past-period marking, the partial-period indicator, the grouped empty state, and signed expense display with a positive override payload on edit.
- Done. Account settings profile, email, and password updates, and account deletion clearing the session.
- Done. The funds chart's zero baseline and negative styling.
- Not covered. `App` and `AuthShell`, so sign in, register, and the password reset forms have no test. Child creation through `ChildForm` and the schedule create form submission are also untested.
- Not applicable. Forecast wizard happy path and shortfall path; no wizard exists.

Docker and Makefile checks, all wired into `make check` and CI:

- Done. `make install`, `make lint`, `make typecheck`, `make test`, `make coverage`, `make security`, `make dependency-check`, `make pr-check`, and a Docker image build.
- Manual. `make docker-up`, health endpoint responds, `/metrics` responds, and logs are written under `/logs` are verified by hand; there is no automated smoke test for the running stack.

## Acceptance Criteria

- Met. A new developer can run the application locally using the documented Makefile and Docker commands.
- Met. All Makefile targets exist and complete successfully; `make check` runs them in CI order.
- Met. No secrets are committed to the repository. `.env.example` holds placeholders only.
- Partial. The default admin account is created and flagged for a forced reset, and login reports the flag, but the frontend does not enforce the reset before granting access to the planner.
- Met. A user can create a child and generate a projected registry.
- Met. Registry projections include deposits, expenses, and monthly investment income.
- Met. Semi-yearly schedules support explicit months.
- Not met. Forecasting is configurable through `.env` for real integrations in Docker, but there are no forecasting tests and therefore no mocked-integration coverage.
- Met. Prometheus can scrape `/metrics`.
- Met. Promtail can scrape logs from the mounted `/logs` directory.

Remaining work implied by the above: enforce the forced admin reset in the frontend, add forecasting tests with mocked Ollama and Brave Search, derive an actual cost from Brave Search results instead of the `30000.00` placeholder, apply one-time contributions to the forecast math, and build a frontend for the forecast endpoint.

## Initial Implementation Order

This sequence is complete. It is retained as a record of how the build was staged.

1. Done. Backend project, `pyproject.toml`, `uv.lock`, configuration, health endpoint, and test harness.
2. Done. PostgreSQL, SQLAlchemy models, and Alembic migrations, now at revision `0003_inv_income`.
3. Done. Auth, user registration, password reset, and admin bootstrap.
4. Done. Child and account CRUD.
5. Done. Schedule CRUD and recurrence expansion.
6. Done. Registry projection and investment income calculations.
7. Done. Metrics and logging.
8. Done. Ollama and Brave Search integration behind `app/services/forecast.py`.
9. Partial. Frontend auth, child management, schedules, and registry are built. There is no separate dashboard and no forecast wizard.
10. Done. Dockerfile, Compose, `.env.example`, Makefile, and Unraid deployment notes in README.md.
11. Done. Tests, coverage, linting, typecheck, and security scan integration, wired into `make check` and CI.

Work added after this sequence and not anticipated by it: balance adjustments, schedule occurrence overrides, investment income overrides, plan status reporting, the display start date cutoff, the available-funds chart, past-row collapsing, inline registry editing, and account maintenance.

