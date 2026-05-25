from functools import lru_cache

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_secret_key: str = "dev-secret-change-me"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
