# College Planner High-Level Design

## Overview

College Planner is a web application for planning and tracking college savings for one or more children. Users define college timelines, savings deposits, expected expenses, and investment return assumptions. The application produces a projected registry showing deposits, expenses, investment income, and running balances over time.

The application also includes an AI-assisted planning flow. Ollama provides local forecasting assistance and explanation, while Brave Search API supplies current cost estimates when the user does not know what to plan for.

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
React Frontend
  |
  | JSON API
  v
FastAPI Backend
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

## Runtime Components

### Frontend

The frontend is a React application. It provides:

- Authentication screens
- Child management
- Deposit and expense schedule management
- Registry table with filters and grouping
- Forecast wizard
- Settings and account screens

### Backend

The backend is a FastAPI application. It provides:

- Auth and password reset APIs
- User-scoped child and account APIs
- Deposit and expense schedule APIs
- Registry projection API
- Forecasting APIs
- Metrics endpoint
- Health endpoint
- Structured logging

### Database

PostgreSQL stores durable application state:

- Users
- Children
- College accounts
- Deposit schedules
- Expense schedules
- Forecast settings and saved scenarios
- Password reset tokens

Projected ledger rows are generated on demand and are not stored as the system of record.

### External Integrations

- SMTP sends password reset emails.
- Ollama provides local forecasting explanations and scenario summaries.
- Brave Search API retrieves current college-cost estimates when needed.
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
- Recurrence details

Supported frequencies:

- Monthly
- Every two weeks
- Semi-monthly
- Quarterly
- Yearly
- Semi-yearly

Semi-monthly schedules must support explicit days of the month and default to the 1st and 15th.

Semi-yearly schedules must support explicit months, such as January and August.

### Expense Schedule

An expense schedule describes future college costs.

Fields:

- Account id
- Start date
- End date
- Amount
- Description
- Frequency
- Recurrence details

Supported frequencies:

- Monthly
- Yearly
- Semi-yearly

Semi-yearly expense schedules must support explicit months.

### Forecast Scenario

A forecast scenario stores non-sensitive forecast inputs and generated outputs.

Fields:

- Account id
- Yearly college cost assumption
- Existing savings amount
- One-time contribution assumptions
- Yearly contribution assumptions
- Expected annual return rate
- Recommended monthly contribution
- User-selected monthly contribution
- Projected shortfall
- Citation metadata when web search is used
- Created timestamp

Income values used to estimate college cost must not be persisted.

## Registry Projection Design

The registry is a projection generated from:

- Account opening balance
- Deposit schedules
- Expense schedules
- Expected annual return rate
- Requested date range

Projection steps:

1. Load the account, child, schedules, and forecast settings.
2. Expand deposit and expense schedules into dated projected rows.
3. Calculate monthly investment income using the effective monthly rate.
4. Sort all calculation rows chronologically.
5. Calculate running balances.
6. Apply display filters and grouping.
7. Return rows or grouped summaries to the frontend.

Default display sort is date descending. Balance calculations must always be performed chronologically before display sorting.

## Investment Income

Convert annual return to an effective monthly rate:

```text
monthly_rate = (1 + annual_rate) ^ (1 / 12) - 1
```

At the end of each projected month, calculate investment income from the prior balance and add it as a registry row. The default annual return is 6%, but users can change it per account or forecast scenario.

## Registry Grouping

Supported grouping modes:

- None
- Month
- Quarter
- Year

Grouped summaries include:

- Time period
- Total deposits
- Total expenses
- Total investment income
- Ending account balance

## Authentication And Authorization

The first version uses private per-user data. A user can access only their own children, accounts, schedules, forecasts, and registry projections.

The app bootstraps a default admin account on startup. The initial default admin password is `ChangeM3!` unless overridden by environment configuration. The admin must reset the password on first login.

Password reset uses expiring tokens sent through SMTP.

## Forecasting Assistant

The forecasting assistant is available during child setup and from the child's account page.

The assistant:

- Asks whether the user wants help creating a plan.
- Asks for expected yearly college cost.
- Uses Brave Search when the user does not know the cost.
- Uses Ollama to explain assumptions and summarize scenarios.
- Asks for current savings.
- Asks for optional one-time or yearly contributions.
- Calculates a recommended monthly savings amount.
- Allows the user to override the monthly amount.
- Estimates shortfall or loan need when the selected contribution is insufficient.

Deterministic financial calculations must be performed by backend code, not by the language model.

## Observability

The application exposes:

- `GET /health`
- `GET /metrics`

Logs are:

- Written to stdout for Docker logs.
- Written to `/logs` for Promtail scraping.
- Structured enough to support searching by request id, level, path, status, and error type.

Logs must not contain secrets, passwords, tokens, API keys, or transient income values.

## Deployment

The app is deployed with Docker Compose.

Compose includes:

- Application container
- PostgreSQL container

External services are configured by environment variable:

- SMTP server
- Ollama endpoint
- Brave Search API
- Prometheus
- Loki/Promtail

The application container mounts `/logs` to a host directory. PostgreSQL stores data in a named volume.

## Operational Interface

Use a Makefile for common operations:

- Install dependencies
- Update dependencies
- Build
- Test
- Coverage
- Lint
- Format
- Security scans
- Docker image build
- Docker Compose up/down
- Local development run
- Clean generated artifacts

All Python commands should use `uv`.

