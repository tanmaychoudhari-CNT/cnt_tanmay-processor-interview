"""Authentication routes.

Three endpoints:
  POST /auth/login  — username+password → bearer token
  GET  /auth/me     — echo the authenticated user (used by the client to
                      hydrate state after a page reload)
  POST /auth/logout — no-op on the server; the client just drops the token
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import LoginRequest, StandardResponse, TokenResponse, UserOut
from app.services import authenticate_user, create_access_token

from ._deps import current_user, limiter


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=StandardResponse[TokenResponse])
# Brute-force hardening: cap login attempts per client IP. 10/min is generous
# for real users fat-fingering a password, but useless to an attacker.
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    # `request` is required by slowapi — it reads the client IP off of it.
    # A single generic 401 for both "unknown user" and "wrong password" so
    # attackers can't enumerate valid usernames by comparing error shapes.
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid username or password",
        )
    token, expires_in = create_access_token(user.username)
    return StandardResponse(
        data=TokenResponse(
            access_token=token,
            expires_in=expires_in,
            username=user.username,
        )
    )


@router.get("/me", response_model=StandardResponse[UserOut])
def me(user=Depends(current_user)):
    # Used by the SPA's AuthContext on boot to re-hydrate user state from
    # the bearer token that's still sitting in localStorage.
    return StandardResponse(data=UserOut.model_validate(user))


@router.post("/logout", response_model=StandardResponse[None])
def logout(_=Depends(current_user)):
    # With stateless JWTs logout is client-side (drop the token). This endpoint
    # exists so the UI can confirm the token is still valid before clearing.
    return StandardResponse(message="logged out")
