"""Pydantic DTOs for the auth routes.

`LoginRequest` is used as the POST body on /auth/login.
`TokenResponse` is what the client caches in localStorage after login.
`UserOut` is what /auth/me returns — the SPA hydrates UI state from it.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    # min_length=1 only — we don't reveal the *real* password rules here so
    # an attacker can't shortcut the validator. `authenticate_user` does the
    # real check (hash compare) regardless of length.
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=255)


class TokenResponse(BaseModel):
    # `expires_in` is seconds-until-expiry (OAuth2 convention) so clients
    # can compute when to re-auth without having to decode the JWT.
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    username: str


class UserOut(BaseModel):
    # `from_attributes=True` lets us pass the SQLAlchemy User ORM model
    # straight in via `UserOut.model_validate(user)` — no manual mapping.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    created_at: datetime
