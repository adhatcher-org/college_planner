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

### Unraid Docker template

The image reads its settings from `/config/.env` (or the file named by `APP_ENV_FILE`), so a plain Unraid template does not need one variable per setting. The file uses the same format as `.env.example`, and quotes around values are removed as they are with Compose.

1. Put the settings file on the server and make it readable only by the container user, uid `999`:

   ```bash
   mkdir -p /mnt/user/appdata/collegeplanner
   cp .env /mnt/user/appdata/collegeplanner/.env
   chown 999:999 /mnt/user/appdata/collegeplanner/.env
   chmod 600 /mnt/user/appdata/collegeplanner/.env
   ```

2. In the template set:
   - **Repository:** `ghcr.io/adhatcher-org/college_planner:latest`
   - **Port:** container `8000`, host port of your choice.
   - **Path:** container `/config`, host `/mnt/user/appdata/collegeplanner`.
   - **Path:** container `/logs`, host log folder for Promtail.
   - **Variable:** `APP_ENV` = `production`. Keep this one in the template, so that a missing or unmounted settings file stops the app instead of starting it on SQLite.
   - **Network:** the network that reaches PostgreSQL, so the migrations that run at startup can connect. Join further networks with Post Arguments such as `&& docker network connect proxy_net college-planner`.

3. Do not also set the secrets as template variables. Environment variables override the file.

Restart the container after editing the file; settings are read once at startup. `APP_PORT`, `APP_LOG_HOST_PATH` and `POSTGRES_*` are used only by Compose and are ignored by the app.

With `APP_ENV=production`, startup fails with a message naming the setting when `DATABASE_URL` points at SQLite, or `APP_SECRET_KEY` is missing or still a placeholder. A settings file that exists but cannot be read, or sits in a folder the container user cannot open, also stops startup, with the path and uid in the message.

## Operations

- `make lint`: backend Ruff and frontend ESLint.
- `make test`: backend pytest and frontend Vitest.
- `make coverage`: coverage reports.
- `make security`: Bandit, pip-audit, and npm audit.
- `make docker-build`: build the application image.
- `make docker-down`: stop the stack.

On startup the app bootstraps `ADMIN_EMAIL` with `ADMIN_INITIAL_PASSWORD` and marks the account for a required password reset. The default is `ChangeM3!`.
