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


class WeakPasswordError(ValueError):
    """Raised when a password fails the minimum-strength check."""


def validate_password_strength(password: str) -> None:
    """Enforce minimum password length. Raise WeakPasswordError if too short.

    Length-only is weak by modern standards, but meaningful as a first gate —
    rejects empty / trivial passwords. Tighten with entropy/zxcvbn checks
    when/if self-signup is added.
    """
    if not isinstance(password, str) or len(password) < settings.password_min_length:
        raise WeakPasswordError(
            f"password must be at least {settings.password_min_length} characters"
        )


def hash_password(password: str) -> str:
    # Always validate before hashing so we never end up with a weak hash on
    # disk. Bcrypt also silently truncates >72 bytes, but that's a different
    # problem handled by _encode above.
    validate_password_strength(password)
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
    """Create the default admin user if the users table is empty.

    Skips seeding if the admin password is too short — forces operators to
    configure a real password via SEED_ADMIN_PASSWORD before bootstrap.
    """
    existing = db.scalar(select(User).limit(1))
    if existing:
        return
    try:
        password_hash = hash_password(settings.seed_admin_password)
    except WeakPasswordError:
        # Don't fall back to seeding with a weak password — log and skip.
        # Operator will see no admin user and must set SEED_ADMIN_PASSWORD.
        import logging

        logging.getLogger(__name__).warning(
            "refusing to seed admin: SEED_ADMIN_PASSWORD is shorter than %d chars",
            settings.password_min_length,
        )
        return
    admin = User(
        username=settings.seed_admin_username,
        password_hash=password_hash,
    )
    db.add(admin)
    db.commit()
