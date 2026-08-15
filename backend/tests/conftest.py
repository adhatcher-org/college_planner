import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["APP_SECRET_KEY"] = "test-secret-change-me-for-local-use-only"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.deps import get_db  # noqa: E402
from app.db.session import Base  # noqa: E402
from app.db.session import engine as app_engine
from app.main import create_app  # noqa: E402
from app.models import domain  # noqa: F401, E402
from app.services.auth import bootstrap_admin  # noqa: E402


@pytest.fixture
def db_session() -> Generator[Session]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    try:
        with TestingSessionLocal() as session:
            bootstrap_admin(session)
            yield session
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient]:
    app = create_app()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app_engine.dispose()
