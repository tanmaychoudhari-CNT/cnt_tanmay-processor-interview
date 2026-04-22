"""Transaction CRUD routes.

Every route is scoped to the authenticated user — a transaction belonging
to user A is invisible to user B, including soft-deleted ones. The scoping
happens in the service layer via `user_id=user.id` on every call.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    BulkCreateResult,
    ManualBulkRequest,
    StandardResponse,
    TransactionCreate,
    TransactionFilters,
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

from ._deps import current_user, limiter


router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=StandardResponse[TransactionListResponse])
def list_(
    filters: TransactionFilters = Depends(),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # `status` field is named `status_` internally to dodge the Python
    # builtin — rename it back when handing to the service.
    params = filters.model_dump(by_alias=False)
    params["status"] = params.pop("status_")
    items, total = list_transactions(db, user_id=user.id, **params)
    return StandardResponse(
        data=TransactionListResponse(
            items=[TransactionOut.model_validate(i) for i in items],
            total=total,
            page=filters.page,
            page_size=filters.page_size,
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
    # File-uploaded rows go through /uploads and get `Batch`.
    # CardValidationError → 400 is handled globally in exception_handlers.py.
    txn = create_transaction(db, payload, user_id=user.id, source="manual_entry")
    return StandardResponse(data=TransactionOut.model_validate(txn))


@router.put("/{transaction_id}", response_model=StandardResponse[TransactionOut])
def update(
    transaction_id: UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # CardValidationError → 400 is handled globally in exception_handlers.py.
    txn = update_transaction(db, transaction_id, payload, user_id=user.id)
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


@router.post("/bulk", response_model=StandardResponse[BulkCreateResult])
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
        data=BulkCreateResult(
            accepted=accepted,
            rejected=rejected,
            rejected_samples=samples,
        )
    )
