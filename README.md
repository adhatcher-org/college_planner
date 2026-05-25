# college_planner

College Planner is a Dockerized FastAPI + React application for planning college savings across one or more children. It supports private user accounts, child-specific college accounts, recurring deposits and expenses, projected investment income, registry filtering/grouping, and forecast scenarios with optional Ollama and Brave Search integrations.

## Local Development

1. Copy `.env.example` to `.env` and replace secrets/passwords.
2. Install dependencies:

```bash
make install
```

3. Run the API:

```bash
make run
```

4. In another shell, run the React dev server:

```bash
cd frontend && npm run dev
```

The API runs at `http://localhost:8000`. The frontend dev server runs at `http://localhost:5173`.

## Docker / Unraid

Copy `.env.example` to `.env`, then set:

- `APP_PORT`: host port to expose the app, default `8000`.
- `APP_SECRET_KEY`: long random secret for JWT signing.
- `POSTGRES_*` and `DATABASE_URL`: database credentials and connection string.
- `APP_LOG_HOST_PATH`: host path mounted to `/logs`, for Promtail scraping.
- `OLLAMA_BASE_URL`: URL for your Ollama service, such as `http://ollama:11434`.
- `BRAVE_SEARCH_API_KEY`: optional API key for current college-cost searches.
- `SMTP_*`: SMTP settings for password reset email.

Start the stack:

```bash
make docker-up
```

Prometheus can scrape `http://<host>:<APP_PORT>/metrics`. Promtail should scrape the host path mapped through `APP_LOG_HOST_PATH`.

## Operations

- `make lint`: backend Ruff and frontend ESLint.
- `make test`: backend pytest and frontend Vitest.
- `make coverage`: coverage reports.
- `make security`: Bandit, pip-audit, and npm audit.
- `make docker-build`: build the application image.
- `make docker-down`: stop the stack.

On startup the app bootstraps `ADMIN_EMAIL` with `ADMIN_INITIAL_PASSWORD` (`ChangeM3!` by default) and marks the account for a required password reset.
