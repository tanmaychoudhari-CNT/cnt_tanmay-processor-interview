"""Transaction CRUD routes.

Every route is scoped to the authenticated user — a transaction belonging
to user A is invisible to user B, including soft-deleted ones. The scoping
happens in the service layer via `user_id=user.id` on every call.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    ManualBulkRequest,
    StandardResponse,
    TransactionCreate,
    TransactionListResponse,
    TransactionOut,
    TransactionUpdate,
)
from app.services import (
    create_transaction,
    create_transactions_bulk,
    delete_transaction,
    get_transaction,
    list_transactions,
    restore_transaction,
    update_transaction,
)
from app.services.card_classifier import CardValidationError

from ._deps import current_user, limiter


router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=StandardResponse[TransactionListResponse])
def list_(
    # Page-size is capped at 10,000 — larger than any UI paginator would ask
    # for, but deliberately generous for the dashboard's "load-all" path.
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=10000),
    search: Optional[str] = Query(None, description="Substring match against card_number"),
    card_number: Optional[str] = Query(None, description="Exact card_number match"),
    sort_by: str = Query("transaction_date"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    card_type: Optional[str] = Query(None),
    source: Optional[str] = Query(None, pattern="^(file_upload|manual_entry)$"),
    status_: Optional[str] = Query(None, alias="status", pattern="^(success|failed|pending)$"),
    date_from: Optional[datetime] = Query(None, description="Inclusive start of transaction_date range"),
    date_to: Optional[datetime] = Query(None, description="Inclusive end of transaction_date range"),
    amount_min: Optional[Decimal] = Query(None, description="Inclusive lower bound on amount"),
    amount_max: Optional[Decimal] = Query(None, description="Inclusive upper bound on amount"),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    items, total = list_transactions(
        db,
        user_id=user.id,
        page=page,
        page_size=page_size,
        search=search,
        card_number=card_number,
        sort_by=sort_by,
        sort_dir=sort_dir,
        card_type=card_type,
        source=source,
        status=status_,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        include_deleted=include_deleted,
    )
    return StandardResponse(
        data=TransactionListResponse(
            items=[TransactionOut.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/{transaction_id}", response_model=StandardResponse[TransactionOut])
def retrieve(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    txn = get_transaction(db, transaction_id, user_id=user.id)
    if not txn:
        raise HTTPException(status_code=404, detail="transaction not found")
    return StandardResponse(data=TransactionOut.model_validate(txn))


@router.post("", response_model=StandardResponse[TransactionOut], status_code=status.HTTP_201_CREATED)
def create(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # Anything created via this endpoint is flagged `manual_entry`.
    # File-uploaded rows go through /uploads and get `file_upload`.
    try:
        txn = create_transaction(db, payload, user_id=user.id, source="manual_entry")
    except CardValidationError as err:
        raise HTTPException(status_code=400, detail=str(err))
    return StandardResponse(data=TransactionOut.model_validate(txn))


@router.put("/{transaction_id}", response_model=StandardResponse[TransactionOut])
def update(
    transaction_id: UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    try:
        txn = update_transaction(db, transaction_id, payload, user_id=user.id)
    except CardValidationError as err:
        raise HTTPException(status_code=400, detail=str(err))
    if not txn:
        raise HTTPException(status_code=404, detail="transaction not found")
    return StandardResponse(data=TransactionOut.model_validate(txn))


@router.delete("/{transaction_id}", response_model=StandardResponse[None])
def delete(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # Soft delete — row stays in the table with is_deleted=True so an admin
    # can restore it. Hard delete isn't exposed through the API.
    if not delete_transaction(db, transaction_id, user_id=user.id):
        raise HTTPException(status_code=404, detail="transaction not found")
    return StandardResponse(message="deleted")


@router.post("/{transaction_id}/restore", response_model=StandardResponse[None])
def restore(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if not restore_transaction(db, transaction_id, user_id=user.id):
        raise HTTPException(
            status_code=404, detail="transaction not found or not soft-deleted"
        )
    return StandardResponse(message="restored")


@router.post("/bulk", response_model=StandardResponse[dict])
# Bulk inserts are expensive — cap them even tighter than the global limit.
# 30 bulk submissions / hour is plenty for real use, nothing for abuse.
@limiter.limit("30/hour")
def bulk_create(
    request: Request,
    payload: ManualBulkRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    accepted, rejected, samples = create_transactions_bulk(
        db, payload.items, user_id=user.id, source="manual_entry"
    )
    return StandardResponse(
        data={
            "accepted": accepted,
            "rejected": rejected,
            "rejected_samples": samples,
        }
    )
