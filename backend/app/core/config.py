import os
from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Settings come from environment variables first, then from these files where they exist.
# `/config/.env` is where a container deployment mounts its settings file; `.env` in the working
# directory is for local development. APP_ENV_FILE names one file explicitly and replaces both.
DEFAULT_ENV_FILES: tuple[str, ...] = (".env", "/config/.env")

# The built-in default and the example placeholder, which must never sign tokens in production.
INSECURE_SECRET_KEYS = frozenset({"dev-secret-change-me-for-local-use-only", "replace-with-a-long-random-secret"})


class Settings(BaseSettings):
    # hide_input_in_errors keeps secrets out of validation error messages and logs.
    model_config = SettingsConfigDict(
        env_file=DEFAULT_ENV_FILES, env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )

    app_env: str = "development"
    app_secret_key: str = "dev-secret-change-me-for-local-use-only"
    database_url: str = "sqlite:///./college_planner.db"

    admin_email: str = "admin@example.com"
    admin_initial_password: str = "ChangeM3!"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "college-planner@example.com"

    ollama_base_url: AnyHttpUrl | None = None
    ollama_model: str = "llama3.1"
    brave_search_api_key: str = ""
    brave_search_base_url: AnyHttpUrl = "https://api.search.brave.com/res/v1/web/search"

    log_dir: str = "/logs"
    cors_allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    access_token_minutes: int = 60 * 24
    password_reset_minutes: int = 30

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def require_production_settings(self) -> Self:
        """Refuse to run in production on development defaults, e.g. when the settings file is missing."""
        if self.app_env.strip().lower() != "production":
            return self
        problems = []
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL points at SQLite; set it to the PostgreSQL URL")
        if self.app_secret_key in INSECURE_SECRET_KEYS:
            problems.append("APP_SECRET_KEY is missing or still a placeholder")
        if problems:
            raise ValueError(
                "APP_ENV=production, but " + "; ".join(problems) + ". Check that the settings file is mounted "
                "(APP_ENV_FILE, or /config/.env in the container) or that these environment variables are set."
            )
        return self


def resolve_env_files() -> tuple[str, ...]:
    """Return the settings files to read, failing loudly on a file that is named but unusable."""
    explicit = os.environ.get("APP_ENV_FILE", "").strip()
    candidates = (explicit,) if explicit else DEFAULT_ENV_FILES
    for candidate in candidates:
        path = Path(candidate)
        # Path.is_file() reports a permission error as "no file", which would silently skip the file.
        try:
            path.stat()
        except PermissionError as exc:
            raise RuntimeError(
                f"Settings file {path} cannot be reached by uid {os.getuid()}. "
                "Check the permissions of the file and of the folders above it."
            ) from exc
        except OSError:
            if explicit:
                raise RuntimeError(f"APP_ENV_FILE is set to {explicit}, but no file exists there.") from None
            continue
        if not path.is_file():
            if explicit:
                raise RuntimeError(f"APP_ENV_FILE is set to {explicit}, but that is not a file.")
            continue
        if not os.access(path, os.R_OK):
            raise RuntimeError(
                f"Settings file {path} exists but cannot be read by uid {os.getuid()}. "
                "Make it readable by the container user, e.g. chown it to that uid and chmod 600."
            )
    return candidates


@lru_cache
def get_settings() -> Settings:
    return Settings(_env_file=resolve_env_files())
