from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    ByCardItem,
    ByCardTypeItem,
    ByDayItem,
    StandardResponse,
    SummaryResponse,
)
from app.services import by_card, by_card_type, by_day, summary

from ._deps import current_user


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=StandardResponse[SummaryResponse])
def get_summary(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return StandardResponse(data=SummaryResponse(**summary(db, user_id=user.id)))


@router.get("/by-card", response_model=StandardResponse[List[ByCardItem]])
def get_by_card(
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return StandardResponse(
        data=[ByCardItem(**row) for row in by_card(db, limit=limit, user_id=user.id)]
    )


@router.get("/by-card-type", response_model=StandardResponse[List[ByCardTypeItem]])
def get_by_card_type(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return StandardResponse(
        data=[ByCardTypeItem(**row) for row in by_card_type(db, user_id=user.id)]
    )


@router.get("/by-day", response_model=StandardResponse[List[ByDayItem]])
def get_by_day(
    limit: int = Query(365, ge=1, le=3650),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return StandardResponse(
        data=[ByDayItem(**row) for row in by_day(db, limit=limit, user_id=user.id)]
    )
