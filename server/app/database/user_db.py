"""DB operations for the `users` table.

All SELECT/INSERT/UPDATE/DELETE on users lives here. Service-layer code
calls these functions instead of building queries inline so the same query
can be reused and the data-access surface stays auditable in one place.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Look up a single user by their unique username."""
    return db.scalar(select(User).where(User.username == username))


def get_first_user(db: Session) -> Optional[User]:
    """Return any one user — used to detect an empty `users` table at boot."""
    return db.scalar(select(User).limit(1))


def insert_user(db: Session, user: User) -> User:
    """Persist a new user and refresh it so server defaults (id, created_at)
    are populated on the returned instance."""
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
