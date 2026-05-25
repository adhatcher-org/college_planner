# College Planner Implementation Plan

## Purpose

Build a Dockerized web application that helps users plan, track, and forecast college savings for one or more children. The application will support child-specific savings accounts, scheduled deposits, scheduled expenses, expected investment income, a projected registry view, password-protected user accounts, observability, and AI-assisted forecasting through Ollama.

This document is intended to be implementation-ready for a future build session.

## Success Criteria

- A user can register, sign in, reset their password by email, and manage only their own data.
- A default admin user is created on startup and forced to reset the default password on first login.
- A user can create one or more children with college start and end dates.
- Each child has an independent college savings account and projected balance.
- A user can define recurring deposits and expenses with flexible recurrence rules.
- The registry view shows projected deposits, expenses, investment income, and running balance.
- The registry can be filtered and collapsed by month, quarter, or year.
- The forecasting assistant can help create a savings plan using user input, Ollama, and optional Brave Search results.
- The application runs locally and on an Unraid server through Docker Compose.
- Metrics are exposed at `/metrics`, and logs are written to `/logs`.
- A Makefile provides standard build, test, lint, coverage, security, dependency, Docker, and local run commands.

## Architecture

Use a split frontend/backend architecture:

- Backend: Python FastAPI
- Python dependency management: uv
- Frontend: React
- Database: PostgreSQL
- Migrations: Alembic
- Authentication: backend-managed email/password auth with secure password hashing
- Email: SMTP configured through environment variables
- Forecasting: Ollama HTTP API
- Web search: Brave Search API
- Metrics: Prometheus-compatible `/metrics`
- Logging: structured application logs written to stdout and `/logs`
- Runtime: Docker Compose

The backend owns all domain logic, recurrence expansion, projected ledger calculations, auth, observability, and external integrations. The frontend consumes backend APIs and provides the user workflows.

## Repository Structure

Create the project using this structure:

```text
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
```

Use Vite for the React frontend unless a future implementation session establishes a stronger reason to choose another React build tool.

## Backend Implementation

### Configuration

Create environment-driven settings for:

- `APP_ENV`
- `APP_SECRET_KEY`
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_INITIAL_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `BRAVE_SEARCH_API_KEY`
- `BRAVE_SEARCH_BASE_URL`
- `LOG_DIR`
- `CORS_ALLOWED_ORIGINS`

All sensitive values must be supplied through `.env` and must not be hardcoded in `docker-compose.yml`.

### Authentication And Users

Implement:

- User registration with email, first name, last name, and password.
- Login using email and password.
- Secure password hashing with a modern password hashing library.
- Session or token-based authentication for the frontend.
- Password reset tokens sent by email through SMTP.
- Default admin bootstrap from environment settings.
- Default admin password of `ChangeM3!` when not overridden.
- Forced password reset on first login for the bootstrapped admin account.

User data must be private by default. A non-admin user can only access their own children, schedules, forecasts, and registry projections.

### Domain Model

Implement these core entities:

- User
- Child
- CollegeAccount
- DepositSchedule
- ExpenseSchedule
- ForecastSettings
- ForecastScenario or ForecastSession
- PasswordResetToken

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

Schedule fields:

- Child or account id
- Type: deposit or expense
- Start date
- End date
- Amount
- Description
- Frequency
- Recurrence details

Supported expense frequencies:

- Monthly
- Yearly
- Semi-yearly with explicit due months

Supported deposit frequencies:

- Monthly
- Every two weeks
- Semi-monthly with explicit days of month, defaulting to the 1st and 15th
- Quarterly
- Yearly
- Semi-yearly with explicit due months

For semi-yearly schedules, never infer "every six months" as the only behavior. Store explicit due months, such as January and August.

### Registry And Ledger Projection

Schedules are the source of truth. Do not pre-create all future ledger rows as persisted transactions.

Implement a projection service that:

- Accepts account id, date range, filters, sort options, and grouping mode.
- Expands schedules into projected ledger rows for the requested date range.
- Calculates balances chronologically.
- Adds monthly investment income rows.
- Returns rows sorted for display, defaulting to date descending.
- Supports grouped summaries by month, quarter, and year.

Ledger row fields:

- Date
- Description
- Type: deposit, expense, investment income, opening balance
- Deposit amount
- Expense amount
- Investment income amount
- Running balance
- Source schedule id when applicable

Investment return:

- Store expected annual return rate per account or forecast settings.
- Default to 6%.
- Convert the annual rate to an effective monthly compounding rate.
- Apply monthly investment income based on the previous month balance.
- Add investment income to the running balance as a projected ledger row.

Registry filtering:

- Date range
- Description search
- Deposit rows only
- Expense rows only
- Investment income rows only
- Amount filters if useful in the UI

### Forecasting Assistant

Implement a guided setup flow available after creating a child.

Flow:

1. Ask whether the user wants help creating a college savings plan.
2. Ask how much the user expects college to cost per year.
3. If the user does not know, use Brave Search API to find current cited estimates.
4. If income is needed for an estimate, ask for it transiently and do not store it.
5. Ask whether the user already has college savings for the child.
6. Ask whether the user expects one-time or yearly contributions, such as bonuses or tax refunds.
7. Use a 6% default annual investment return unless the user changes it.
8. Calculate the monthly contribution needed to cover projected costs.
9. Allow the user to override the monthly contribution.
10. If the override creates a shortfall, estimate the loan amount required.

Ollama responsibilities:

- Explain assumptions.
- Summarize the proposed plan.
- Generate human-readable scenario commentary.

Backend responsibilities:

- Perform deterministic financial calculations.
- Store only non-sensitive planning inputs.
- Keep transient income values out of persistence and logs.
- Attach citations when Brave Search is used.

### Observability

Implement:

- `/metrics` endpoint for Prometheus scraping.
- Structured logs to stdout.
- Structured logs written to files under `/logs`.
- Request logging with method, path, status, duration, and request id.
- Error logging without secrets or sensitive transient values.
- Health endpoint for Docker health checks.

Recommended metrics:

- HTTP request count
- HTTP request latency
- HTTP response status count
- Forecast request count
- Forecast error count
- Registry projection latency
- Database connection health

## Frontend Implementation

Use React with a component structure organized by feature:

- Auth
- Children
- Schedules
- Registry
- Forecasting
- Settings

Required screens:

- Login
- Register
- Forced password reset
- Forgot password
- Reset password
- Dashboard
- Child list
- Child create/edit
- Deposit schedule create/edit
- Expense schedule create/edit
- Registry view
- Forecast wizard
- Account/settings page

Registry UI:

- Show date, description, deposit, expense, investment income, and running balance.
- Support filters in or near table headers.
- Support collapse/group by none, month, quarter, and year.
- In grouped mode, show period, total deposits, total expenses, total investment income, and ending balance.
- Default to date descending display.
- Preserve selected child/account and filters in URL query parameters where practical.

Forecast wizard UI:

- Start after child creation when the user opts in.
- Let the user enter known yearly cost or request help estimating it.
- Show cited search results when Brave Search is used.
- Show recommended monthly savings.
- Let the user change the monthly contribution.
- Show any projected shortfall or estimated loan need.

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

The app service should:

- Expose the web app port through an environment-configurable host port.
- Mount `/logs` to a host path.
- Use environment variables from `.env`.
- Run database migrations on startup or provide a documented migration command.
- Include a health check.
- Run as a non-root user where practical.

The PostgreSQL service should:

- Store data in a named volume.
- Use credentials from `.env`.
- Avoid hardcoded passwords in Compose.

Include Unraid notes in README or deployment docs:

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

Create a Makefile as the primary developer command surface.

Required targets:

- `install`: install backend dependencies with `uv sync` and frontend dependencies.
- `update`: update Python dependencies with `uv lock --upgrade` and update frontend dependencies.
- `build`: build backend checks and frontend production assets.
- `test`: run backend and frontend tests.
- `coverage`: run tests with coverage reports.
- `lint`: run Ruff and frontend linting.
- `format`: format backend and frontend code.
- `security`: run Python dependency/security scans and frontend audit.
- `docker-build`: build application container images.
- `docker-up`: run the local stack with Docker Compose.
- `docker-down`: stop the local Docker Compose stack.
- `run`: run the local development stack.
- `clean`: remove generated build/test artifacts only.

Use `uv` for all Python dependency and command execution. Do not use pip directly in normal developer commands.

Recommended backend tools:

- `ruff` for linting and formatting
- `pytest` for tests
- `pytest-cov` for coverage
- `pip-audit` or equivalent via `uv run` for Python dependency scanning
- `bandit` for Python security checks

Recommended frontend tools:

- npm or pnpm, chosen during implementation
- ESLint
- Vitest
- frontend package audit command

## Testing Plan

Backend unit tests:

- Monthly recurrence expansion.
- Yearly recurrence expansion.
- Quarterly recurrence expansion.
- Every-two-weeks recurrence expansion.
- Semi-monthly recurrence expansion.
- Semi-yearly recurrence expansion with explicit months.
- Default child end date is 45 months after start date.
- Monthly compounding return calculations.
- Running balance calculations.
- Registry grouping by month, quarter, and year.

Backend API tests:

- Register user.
- Login user.
- Bootstrap admin.
- Force admin password reset.
- Password reset email flow.
- Create, update, list, and delete children.
- Create, update, list, and delete deposit schedules.
- Create, update, list, and delete expense schedules.
- Registry query with date filters.
- Registry query with description filters.
- User cannot access another user's data.

Forecasting tests:

- Forecast with user-entered yearly cost.
- Forecast with mocked Brave Search results.
- Forecast with mocked Ollama response.
- Transient income is not persisted.
- Reduced monthly contribution produces projected shortfall.

Frontend tests:

- Auth flows.
- Child creation flow.
- Schedule forms.
- Registry filters.
- Registry grouped views.
- Forecast wizard happy path.
- Forecast shortfall path.

Docker and Makefile smoke tests:

- `make install`
- `make lint`
- `make test`
- `make coverage`
- `make security`
- `make docker-build`
- `make docker-up`
- App health endpoint responds.
- `/metrics` responds.
- Logs are written under `/logs`.

## Acceptance Criteria

- A new developer can run the application locally using documented Makefile and Docker commands.
- All required Makefile targets exist and complete successfully.
- No secrets are committed to the repository.
- The default admin account is created and forced to reset its password.
- A user can create a child and generate a projected registry.
- Registry projections include deposits, expenses, and monthly investment income.
- Semi-yearly schedules support explicit months.
- Forecasting works with mocked integrations in tests and configurable real integrations in Docker.
- Prometheus can scrape `/metrics`.
- Promtail can scrape logs from the mounted `/logs` directory.

## Initial Implementation Order

1. Create backend project, `pyproject.toml`, `uv.lock`, configuration, health endpoint, and test harness.
2. Add PostgreSQL, SQLAlchemy or SQLModel models, and Alembic migrations.
3. Implement auth, user registration, password reset, and admin bootstrap.
4. Implement child and account CRUD.
5. Implement schedule CRUD and recurrence expansion.
6. Implement registry projection and investment income calculations.
7. Implement metrics and logging.
8. Implement Ollama and Brave Search integration behind service interfaces.
9. Implement frontend auth, dashboard, child management, schedules, registry, and forecast wizard.
10. Add Dockerfile, Compose, `.env.example`, Makefile, and Unraid deployment notes.
11. Complete tests, coverage, linting, and security scan integration.

