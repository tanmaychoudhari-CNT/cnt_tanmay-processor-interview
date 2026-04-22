"""Shared FastAPI dependencies for the route modules.

Only two things live here:

* `current_user` — resolves the Bearer token on every protected route and
  hands the ORM `User` to the handler. Routes just declare it via `Depends`.
* `limiter` — the shared slowapi instance. Every per-route `@limiter.limit(...)`
  decorator must resolve to the SAME instance that's wired into
  `app.state.limiter` in `main.py`, otherwise slowapi silently fails open.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.services import decode_token


# `auto_error=False` lets us return our own 401 shape instead of the default
# FastAPI/Starlette error body — the clients we control expect `detail` only.
bearer_scheme = HTTPBearer(auto_error=False)

# Shared limiter instance so individual routes can apply stricter per-route
# caps on top of the global default. Must match the instance in main.app.state
# — slowapi uses `request.app.state.limiter` at enforcement time.
#   default_limits: global ceiling per client IP across all routes.
#   routes can add `@limiter.limit("10/minute")` for stricter caps.
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the signed-in user from the `Authorization: Bearer <jwt>` header.

    All three failure modes collapse to the same 401 response — we never
    distinguish "no header" from "bad signature" from "user gone" to the
    client, since finer detail would help an attacker enumerate valid
    tokens/usernames.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    username = decode_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token")
    user = db.scalar(select(User).where(User.username == username))
    if not user:
        # Token decoded but the user was deleted under us — treat as invalid.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return user
