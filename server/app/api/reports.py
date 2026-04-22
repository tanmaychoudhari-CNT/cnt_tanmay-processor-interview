"""Aggregated report endpoints for dashboard charts.

All four endpoints are scoped to the authenticated user and exclude
soft-deleted rows. They return *aggregations over the full dataset* — the
dashboard uses them instead of re-aggregating the /transactions page so the
charts reflect every row even when the grid is capped at 10k.
"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    ByCardItem,
    ByCardTypeItem,
    ByDayItem,
    BySourceResponse,
    StandardResponse,
    SummaryResponse,
)
from app.services import by_card, by_card_type, by_day, by_source, summary

from ._deps import current_user


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=StandardResponse[SummaryResponse])
def get_summary(db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Headline KPIs — total volume, averages, extremes, deleted count.
    return StandardResponse(data=SummaryResponse(**summary(db, user_id=user.id)))


@router.get("/by-card", response_model=StandardResponse[List[ByCardItem]])
def get_by_card(
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # Top cards by total volume. Powers the "Top cards" insights panel.
    return StandardResponse(
        data=[ByCardItem(**row) for row in by_card(db, limit=limit, user_id=user.id)]
    )


@router.get("/by-card-type", response_model=StandardResponse[List[ByCardTypeItem]])
def get_by_card_type(db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Brand mix — powers the donut chart on the dashboard.
    return StandardResponse(
        data=[ByCardTypeItem(**row) for row in by_card_type(db, user_id=user.id)]
    )


@router.get("/by-source", response_model=StandardResponse[BySourceResponse])
def get_by_source(db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Real-time count of Batch vs manual_entry rows. Powers the
    # "Processing source" insight card so the split reflects every row in
    # the DB rather than the 10k window the grid uses.
    counts = by_source(db, user_id=user.id)
    total = counts["upload"] + counts["manual"] + counts["unknown"]
    return StandardResponse(data=BySourceResponse(**counts, total=total))


@router.get("/by-day", response_model=StandardResponse[List[ByDayItem]])
def get_by_day(
    limit: int = Query(365, ge=1, le=3650),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # Daily volume series — powers the trend/area chart. Default of 365 days
    # is one year; the UI usually asks for the last 90.
    return StandardResponse(
        data=[ByDayItem(**row) for row in by_day(db, limit=limit, user_id=user.id)]
    )
