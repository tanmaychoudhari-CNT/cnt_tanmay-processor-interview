from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import LoginRequest, StandardResponse, TokenResponse, UserOut
from app.services import authenticate_user, create_access_token

from ._deps import current_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=StandardResponse[TokenResponse])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
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
    return StandardResponse(data=UserOut.model_validate(user))


@router.post("/logout", response_model=StandardResponse[None])
def logout(_=Depends(current_user)):
    # With stateless JWTs logout is client-side (drop the token). This endpoint
    # exists so the UI can confirm the token is still valid before clearing.
    return StandardResponse(message="logged out")
