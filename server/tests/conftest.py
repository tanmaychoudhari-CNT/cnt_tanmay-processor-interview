"""Shared pytest fixtures.

Every test gets a fresh in-memory SQLite database and a FastAPI TestClient
wired to it. The production Postgres instance is never touched.
"""
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "unit-test-secret")
os.environ.setdefault("SEED_ADMIN_USERNAME", "admin")
os.environ.setdefault("SEED_ADMIN_PASSWORD", "admin123")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import database as db_module
from app.database import Base, get_db
from app.models import User
from app.services.auth_service import hash_password


@pytest.fixture
def db_engine():
    """Fresh in-memory SQLite engine per test. StaticPool keeps the single
    connection alive so all sessions see the same in-memory DB."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _disable_rate_limiter():
    """Rate limits must not apply in tests — `auth_token` hits /login many
    times per second, which would trip the real 10/minute cap in seconds.
    Toggle the limiter off globally for the duration of every test."""
    from app.api._deps import limiter

    prev = limiter.enabled
    limiter.enabled = False
    try:
        yield
    finally:
        limiter.enabled = prev


@pytest.fixture
def client(db_engine):
    """FastAPI TestClient with get_db overridden to use the test engine.

    We also bypass the app's lifespan (which would try to use the module-level
    engine pointed at Postgres). Tables are already created by db_engine.
    """
    TestSession = sessionmaker(bind=db_engine, autoflush=False, autocommit=False, future=True)

    # Seed the admin user directly (the lifespan normally does this).
    with TestSession() as s:
        s.add(
            User(username="admin", password_hash=hash_password("admin123"))
        )
        s.commit()

    # Patch the module-level engine so any code that still references it uses
    # the SQLite in-memory engine.
    original_engine = db_module.engine
    original_session_local = db_module.SessionLocal
    db_module.engine = db_engine
    db_module.SessionLocal = TestSession

    from main import app

    def override_get_db():
        s = TestSession()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db

    # Do NOT enter the lifespan — we've handled setup manually above.
    test_client = TestClient(app)

    yield test_client

    app.dependency_overrides.clear()
    db_module.engine = original_engine
    db_module.SessionLocal = original_session_local


@pytest.fixture
def auth_token(client):
    """Bearer token for the seeded admin user."""
    r = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["data"]["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
