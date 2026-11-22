import os
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_ENV_FILES, Settings, resolve_env_files

PRODUCTION_ENV = {
    "APP_ENV": "production",
    "DATABASE_URL": "postgresql+psycopg://college_planner:pw@postgresql:5432/college_planner",
    "APP_SECRET_KEY": "a-real-secret-from-the-operator",
    "ADMIN_INITIAL_PASSWORD": "a-real-admin-password",
}
SETTING_KEYS = (*PRODUCTION_ENV, "APP_ENV_FILE", "SMTP_HOST")


@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> pytest.MonkeyPatch:
    for key in SETTING_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.chdir(tmp_path)
    return monkeypatch


def write_env_file(path: Path, values: dict[str, str]) -> Path:
    path.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
    return path


def test_default_env_files_include_config_mount(clean_env: pytest.MonkeyPatch) -> None:
    assert resolve_env_files() == DEFAULT_ENV_FILES
    assert "/config/.env" in DEFAULT_ENV_FILES


def test_explicit_env_file_is_loaded(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    env_file = write_env_file(tmp_path / "app.env", {**PRODUCTION_ENV, "SMTP_HOST": '"smtp.example.com"'})
    clean_env.setenv("APP_ENV_FILE", str(env_file))

    settings = Settings(_env_file=resolve_env_files())

    assert settings.app_env == "production"
    assert settings.database_url.startswith("postgresql")
    assert settings.smtp_host == "smtp.example.com"


def test_explicit_env_file_must_exist(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    missing = tmp_path / "missing.env"
    clean_env.setenv("APP_ENV_FILE", str(missing))

    with pytest.raises(RuntimeError, match="missing.env"):
        resolve_env_files()


@pytest.mark.skipif(os.name != "posix" or os.geteuid() == 0, reason="root can read any file")
def test_unreadable_env_file_names_the_path(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    env_file = write_env_file(tmp_path / "locked.env", PRODUCTION_ENV)
    env_file.chmod(0o000)
    clean_env.setenv("APP_ENV_FILE", str(env_file))

    try:
        with pytest.raises(RuntimeError, match="cannot be read"):
            resolve_env_files()
    finally:
        env_file.chmod(0o600)


@pytest.mark.skipif(os.name != "posix" or os.geteuid() == 0, reason="root can read any folder")
def test_env_file_in_unreadable_folder_is_not_silently_skipped(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    folder = tmp_path / "config"
    folder.mkdir()
    env_file = write_env_file(folder / ".env", PRODUCTION_ENV)
    folder.chmod(0o000)
    clean_env.setenv("APP_ENV_FILE", str(env_file))

    try:
        with pytest.raises(RuntimeError, match="cannot be reached"):
            resolve_env_files()
    finally:
        folder.chmod(0o700)


def test_explicit_env_file_must_be_a_file(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    clean_env.setenv("APP_ENV_FILE", str(tmp_path))

    with pytest.raises(RuntimeError, match="not a file"):
        resolve_env_files()


def test_environment_variables_override_env_file(clean_env: pytest.MonkeyPatch, tmp_path: Path) -> None:
    env_file = write_env_file(tmp_path / "app.env", {**PRODUCTION_ENV, "SMTP_HOST": "from-file"})
    clean_env.setenv("APP_ENV_FILE", str(env_file))
    clean_env.setenv("SMTP_HOST", "from-environment")

    assert Settings(_env_file=resolve_env_files()).smtp_host == "from-environment"


def test_development_allows_defaults(clean_env: pytest.MonkeyPatch) -> None:
    settings = Settings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.database_url.startswith("sqlite")


def test_production_with_real_settings_starts(clean_env: pytest.MonkeyPatch) -> None:
    for key, value in PRODUCTION_ENV.items():
        clean_env.setenv(key, value)

    assert Settings(_env_file=None).app_env == "production"


@pytest.mark.parametrize(
    ("key", "value", "message"),
    [
        ("DATABASE_URL", "sqlite:///./college_planner.db", "DATABASE_URL"),
        ("APP_SECRET_KEY", "dev-secret-change-me-for-local-use-only", "APP_SECRET_KEY"),
        ("APP_SECRET_KEY", "replace-with-a-long-random-secret", "APP_SECRET_KEY"),
    ],
)
def test_production_rejects_defaults(clean_env: pytest.MonkeyPatch, key: str, value: str, message: str) -> None:
    for name, setting in PRODUCTION_ENV.items():
        clean_env.setenv(name, setting)
    clean_env.setenv(key, value)

    with pytest.raises(ValidationError, match=message):
        Settings(_env_file=None)


def test_production_with_no_settings_lists_every_problem(clean_env: pytest.MonkeyPatch) -> None:
    clean_env.setenv("APP_ENV", "production")

    with pytest.raises(ValidationError) as excinfo:
        Settings(_env_file=None)

    error = str(excinfo.value)
    for key in ("DATABASE_URL", "APP_SECRET_KEY", "/config/.env"):
        assert key in error


def test_production_allows_default_admin_password(clean_env: pytest.MonkeyPatch) -> None:
    # Only used to create the first admin, who must reset it at first sign-in; existing deployments still use it.
    for key, value in PRODUCTION_ENV.items():
        clean_env.setenv(key, value)
    clean_env.setenv("ADMIN_INITIAL_PASSWORD", "ChangeM3!")

    assert Settings(_env_file=None).admin_initial_password == "ChangeM3!"


def test_production_error_does_not_echo_setting_values(clean_env: pytest.MonkeyPatch) -> None:
    clean_env.setenv("APP_ENV", "production")
    clean_env.setenv("SMTP_PASSWORD", "smtp-secret-value")

    with pytest.raises(ValidationError) as excinfo:
        Settings(_env_file=None)

    assert "smtp-secret-value" not in str(excinfo.value)
