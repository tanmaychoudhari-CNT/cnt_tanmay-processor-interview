from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import User


# bcrypt hard-caps input at 72 bytes. Truncate to match the cap silently so
# callers don't have to think about it; this is the same behaviour passlib used.
_BCRYPT_MAX = 72


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_encode(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(username: str) -> tuple[str, int]:
    expires_delta = timedelta(minutes=settings.jwt_expires_minutes)
    exp = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": username, "exp": exp}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def ensure_seed_admin(db: Session) -> None:
    """Create the default admin user if the users table is empty."""
    existing = db.scalar(select(User).limit(1))
    if existing:
        return
    admin = User(
        username=settings.seed_admin_username,
        password_hash=hash_password(settings.seed_admin_password),
    )
    db.add(admin)
    db.commit()
