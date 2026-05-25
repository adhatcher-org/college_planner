# ADR-0004: Auth, Observability, And Deployment

## Status

Accepted

## Context

The application needs user accounts, private data, password reset by email, a default admin user, monitoring, logging, Docker deployment, and Unraid compatibility.

The requirements specify:

- Default admin password of `ChangeM3!`.
- Admin must reset password on initial login.
- Password reset via email.
- Metrics at `/metrics`.
- Logs written to `/logs`.
- Docker Compose with secrets and connection strings in `.env`.

## Decision

Implement private per-user data, backend-managed authentication, SMTP password reset, default admin bootstrap with forced password reset, Prometheus metrics, structured logs written to `/logs`, and Docker Compose deployment.

Use a Makefile for repeatable developer and operator commands.

## Rationale

Private per-user data is the simplest secure model for the first version. It avoids household sharing, invites, and permission complexity while still supporting multiple children per user.

SMTP is broadly compatible with home-lab and hosted mail setups.

Prometheus metrics and `/logs` output fit the target Grafana, Loki, and Promtail environment.

Docker Compose keeps the app and database deployment explicit and works well for Unraid.

A Makefile gives future implementation sessions a stable command surface for build, test, lint, coverage, security, Docker, and local run tasks.

## Consequences

- The first version does not support shared household planning.
- Admin behavior must be carefully tested so the default password cannot remain active unnoticed.
- Email configuration must be validated during deployment.
- Logs must be scrubbed of secrets, tokens, passwords, API keys, and transient income values.
- Prometheus and Promtail are external services, not required containers in the app Compose file.

## Implementation Notes

Authentication:

- Email is the account name.
- Store password hashes only.
- Use expiring password reset tokens.
- Force the default admin to reset the initial password.
- Scope all user data queries by owner user id.

Observability:

- Expose `GET /health`.
- Expose `GET /metrics`.
- Write structured logs to stdout.
- Write structured logs to `/logs`.
- Include request id, method, path, status, duration, and level where practical.

Docker:

- Use `.env` for secrets and connection strings.
- Mount `/logs` from the app container to the host.
- Store PostgreSQL data in a named volume.
- Include health checks.
- Use a non-root app user where practical.

Makefile targets:

- `install`
- `update`
- `build`
- `test`
- `coverage`
- `lint`
- `format`
- `security`
- `docker-build`
- `docker-up`
- `docker-down`
- `run`
- `clean`

