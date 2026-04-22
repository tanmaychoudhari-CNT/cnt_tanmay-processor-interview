"""SQLAlchemy engine, session factory, and declarative Base.

`get_db` is the FastAPI dependency — a per-request session that always
closes itself, even on exception. Never instantiate `SessionLocal()`
directly inside a route; always go through `Depends(get_db)` so teardown
is guaranteed.
"""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


# Engine config tuned for a small multi-worker deployment:
#   pool_pre_ping: drop dead connections before they poison a request
#   pool_size:     steady-state connections per worker
#   max_overflow:  burst above steady-state under load
#   pool_timeout:  fail fast if we can't get a connection (instead of hanging)
#   pool_recycle:  stop reusing a connection after 30 min (avoids stale TCP)
#
# SQLite (used in tests) ignores pool_size/overflow, so the same args work
# across dialects without branching.
engine_kwargs = {
    "pool_pre_ping": True,
    "future": True,
}
if not settings.database_url.startswith("sqlite"):
    engine_kwargs.update(
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    """FastAPI dependency: yield a session, close it on request teardown."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
