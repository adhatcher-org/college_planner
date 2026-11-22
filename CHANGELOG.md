# Changelog

## Unreleased

### Added

- Settings can come from a mounted file at `/config/.env`, or the file named by `APP_ENV_FILE`, so a plain Unraid Docker template needs no per-setting variables.
- With `APP_ENV=production`, startup now fails with a clear message when `DATABASE_URL` points at SQLite or `APP_SECRET_KEY` is missing or still a placeholder, instead of silently running on development defaults. An unreadable settings file, or one in a folder the container user cannot open, also stops startup. Settings validation errors no longer echo setting values.

### Fixed

- The container no longer downloads dev dependencies (ruff, pytest and others) on every start. The start command used a plain `uv run`, which re-synced the default dev group that the image is built without; it now uses `uv run --no-sync`, and `UV_NO_SYNC=1` covers `docker exec ... uv run`.
- `CORS_ALLOWED_ORIGINS` accepts a comma-separated list, as in `.env.example`, as well as a JSON list. A comma-separated value used to stop startup with `SettingsError: error parsing value for field "cors_allowed_origins"`; a malformed JSON list now fails with a message naming the setting.

### Changed

- Consolidated registry row amounts from separate deposit, expense, and investment income fields into a single `amount` field.
- Updated registry running balance, sorting, grouping, API tests, and frontend totals to use the unified amount model.
- Updated the registry table to display one `Amount` column.
- Increased chart left padding so y-axis currency labels are not clipped.
- Split schedule management into separate main-window sections for add/edit actions and recurring schedule lists, launched from the sidebar.
- Added authenticated account maintenance for profile/email updates, password changes, password reset, and account deletion.
- Added child deletion confirmation before removing a child and their account data.
- Added in-app plan status reporting for Successful, Loans Required, and Short Fall projections.
- Excluded vulnerable FastAPI `0.136.3` and refreshed the backend lockfile to resolve the CI security audit failure.
- Improved the security remediation workflow resilience.
- Added frontend interaction tests for sidebar-launched schedule sections, recurring schedule edit handoff, and signed registry amount display with positive expense edit payloads.
- Configured Vitest with `jsdom` and Testing Library setup for component-level frontend tests.
