from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_runtime_schema(engine: Engine) -> None:
    """Apply additive dev-schema fixes for databases created before migrations existed."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "schedule_occurrence_overrides" in existing_tables:
            _add_sqlite_column_if_missing(
                connection,
                inspector,
                "schedule_occurrence_overrides",
                "is_deleted",
                "BOOLEAN NOT NULL DEFAULT 0",
            )
        if "investment_income_overrides" in existing_tables:
            _add_sqlite_column_if_missing(
                connection,
                inspector,
                "investment_income_overrides",
                "is_deleted",
                "BOOLEAN NOT NULL DEFAULT 0",
            )


def _add_sqlite_column_if_missing(connection, inspector, table_name: str, column_name: str, definition: str) -> None:
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if column_name not in columns:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))
