# ADR-0001: Application Architecture

## Status

Accepted

## Context

College Planner needs a web frontend, durable persistence, user accounts, financial projection logic, AI-assisted forecasting, Docker deployment, and home-lab operational support. The application will run on an Unraid server in Docker containers.

The backend needs to perform deterministic financial calculations and integrate with PostgreSQL, SMTP, Ollama, Brave Search API, Prometheus, and file-based logs. The frontend needs a rich registry UI with filtering and grouping.

## Decision

Use:

- FastAPI for the backend.
- React for the frontend.
- PostgreSQL for persistence.
- Alembic for database migrations.
- uv for Python dependency management and command execution.
- Docker Compose for local and Unraid deployment.
- Makefile targets as the primary developer and operator command surface.

## Rationale

FastAPI is a strong fit for a Python backend with typed API contracts, async-friendly integrations, and clear service boundaries. Python is also a good fit for financial projection code and future forecasting logic.

React is a good fit for the registry UI because the application needs filtering, grouping, wizard flows, and responsive account views.

PostgreSQL provides reliable relational storage for multi-user data, schedules, forecasts, and reporting queries.

uv provides fast, reproducible Python dependency management and aligns with the preferred tooling for new Python projects.

Docker Compose fits the Unraid target and keeps the app, database, environment variables, volumes, ports, logs, and health checks explicit.

## Consequences

- The app has separate frontend and backend build/test paths.
- The backend owns business logic and calculation correctness.
- The frontend consumes API responses rather than duplicating financial logic.
- PostgreSQL is required for normal local and production operation.
- Docker Compose must define both app and database services.
- Developer documentation must keep Makefile commands current.

## Implementation Notes

- Use environment variables for all runtime configuration.
- Keep secrets in `.env`; do not hardcode them in `docker-compose.yml`.
- Use `uv sync`, `uv run`, and `uv lock` for Python workflows.
- Include a Docker health check for the app service.
- Include an `.env.example` with placeholder values only.

