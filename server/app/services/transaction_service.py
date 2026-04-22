"""Business logic for the /transactions + /reports endpoints.

This module is the API layer's only entry point into transaction logic.
All SQL — selects, inserts, updates, deletes, aggregations — is delegated
to `app.database.transaction_db`. The service layer's job is to:

  * validate / normalize input (card numbers, statuses, sources)
  * stamp server-controlled fields (user_id, source, status="success")
  * translate user-friendly filter values (e.g. "Visa") into the literal
    column predicates the DB layer understands (leading-digit "4")

Every user-facing operation is scoped by `user_id` so a transaction
belonging to user A is invisible to user B.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.database import transaction_db
from app.models import Transaction
from app.models.transaction import CARD_TYPES, TX_SOURCES, TX_STATUSES
from app.schemas.transaction import ManualEntry, TransactionCreate, TransactionUpdate
from app.services.card_classifier import CardValidationError, classify_card


# ---------------------------------------------------------------------------
# Internal helpers — input validation + normalization for filter values
# ---------------------------------------------------------------------------


def _validate_source(source: str) -> str:
    if source not in TX_SOURCES:
        raise ValueError(f"invalid source '{source}'; allowed: {TX_SOURCES}")
    return source


def _validate_status(status: str) -> str:
    if status not in TX_STATUSES:
        raise ValueError(f"invalid status '{status}'; allowed: {TX_STATUSES}")
    return status


def _resolve_timestamp(ts: Optional[datetime]) -> datetime:
    if ts is not None:
        return ts
    # Naive UTC — matches DateTime(timezone=False) columns.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_card_input(value: Optional[str]) -> Optional[str]:
    """Strip non-digits from a raw filter input. Empty → None so the DB
    layer can skip the filter entirely instead of issuing `LIKE '%%'`."""
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None


def _card_type_to_leading_digit(card_type: Optional[str]) -> Optional[str]:
    """Reverse-lookup: map a brand name like "Visa" to the leading digit
    "4" so the DB layer can apply a `card_number LIKE '4%'` filter. Returns
    None for unknown brands so the filter is skipped instead of matching nothing."""
    if not card_type:
        return None
    return next((k for k, v in CARD_TYPES.items() if v == card_type), None)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def create_transaction(
    db: Session,
    payload: TransactionCreate,
    *,
    user_id: UUID,
    source: str = "manual_entry",
    file_name: Optional[str] = None,
) -> Transaction:
    """Insert a single transaction. Raises CardValidationError on bad card.

    `status` is hard-coded to "success" because the app doesn't model the
    lifecycle of a real card-processor — every create is a completed record.
    Status is mutable later via `update_transaction`.
    """
    _validate_source(source)
    normalized, _ = classify_card(payload.card_number)
    txn = Transaction(
        user_id=user_id,
        status="success",
        source=source,
        file_name=file_name,
        remarks=payload.remarks,
        card_number=normalized,
        amount=payload.amount,
        transaction_date=_resolve_timestamp(payload.transaction_date),
    )
    return transaction_db.insert_transaction(db, txn)


def create_transactions_bulk(
    db: Session,
    items: Iterable[TransactionCreate | ManualEntry],
    *,
    user_id: UUID,
    source: str = "manual_entry",
    file_name: Optional[str] = None,
) -> Tuple[int, int, List[str]]:
    """Insert many rows in one commit. Returns (accepted, rejected, samples).

    Invalid rows are skipped (not fatal) so a single bad card number doesn't
    reject the whole batch. At most 5 rejection reasons are surfaced back —
    enough for the UI to show a useful message without flooding the response.
    """
    _validate_source(source)
    accepted = 0
    rejected = 0
    samples: List[str] = []
    batch: List[Transaction] = []

    for item in items:
        try:
            normalized, _ = classify_card(item.card_number)
        except CardValidationError as err:
            rejected += 1
            if len(samples) < 5:
                samples.append(f"{item.card_number}: {err}")
            continue

        ts = getattr(item, "transaction_date", None)
        batch.append(
            Transaction(
                user_id=user_id,
                status="success",
                source=source,
                file_name=file_name,
                remarks=getattr(item, "remarks", None),
                card_number=normalized,
                amount=item.amount,
                transaction_date=_resolve_timestamp(ts),
            )
        )
        accepted += 1

    transaction_db.insert_transactions(db, batch)
    return accepted, rejected, samples


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> Optional[Transaction]:
    return transaction_db.get_transaction(db, transaction_id, user_id=user_id)


def list_transactions(
    db: Session,
    *,
    user_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    card_number: Optional[str] = None,
    sort_by: str = "transaction_date",
    sort_dir: str = "desc",
    card_type: Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    include_deleted: bool = False,
) -> Tuple[List[Transaction], int]:
    """Normalize the filter inputs from the API layer and hand them to the
    DB layer for execution. The pagination clamp is a service concern (it
    enforces a UX-level cap) rather than a DB concern.
    """
    page = max(1, page)
    page_size = max(1, min(page_size, 10000))

    return transaction_db.list_transactions(
        db,
        user_id=user_id,
        page=page,
        page_size=page_size,
        search_digits=_normalize_card_input(search),
        card_number=_normalize_card_input(card_number),
        sort_by=sort_by,
        sort_dir=sort_dir,
        card_leading_digit=_card_type_to_leading_digit(card_type),
        source=source,
        status=status,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        include_deleted=include_deleted,
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


def update_transaction(
    db: Session,
    transaction_id: UUID,
    payload: TransactionUpdate,
    *,
    user_id: Optional[UUID] = None,
) -> Optional[Transaction]:
    """PATCH-style update — only touches fields that the caller explicitly
    provided (i.e. were not None on the payload)."""
    txn = transaction_db.get_transaction(db, transaction_id, user_id=user_id)
    if not txn:
        return None

    if payload.card_number is not None:
        normalized, _ = classify_card(payload.card_number)
        txn.card_number = normalized
    if payload.amount is not None:
        txn.amount = payload.amount
    if payload.transaction_date is not None:
        txn.transaction_date = payload.transaction_date
    if payload.status is not None:
        txn.status = _validate_status(payload.status)
    if payload.remarks is not None:
        txn.remarks = payload.remarks

    return transaction_db.save_transaction(db, txn)


# ---------------------------------------------------------------------------
# Soft delete + restore
# ---------------------------------------------------------------------------


def delete_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> bool:
    txn = transaction_db.get_transaction(db, transaction_id, user_id=user_id)
    if not txn:
        return False
    transaction_db.soft_delete_transaction(db, txn)
    return True


def restore_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> bool:
    # Restore needs to see soft-deleted rows, so we use the variant that
    # ignores the is_deleted=False filter.
    txn = transaction_db.get_transaction_including_deleted(
        db, transaction_id, user_id=user_id
    )
    if not txn or not txn.is_deleted:
        return False
    transaction_db.restore_transaction_row(db, txn)
    return True


# ---------------------------------------------------------------------------
# Reports — thin pass-throughs to the DB aggregation queries.
# ---------------------------------------------------------------------------


def summary(db: Session, *, user_id: Optional[UUID] = None) -> dict:
    return transaction_db.aggregate_summary(db, user_id=user_id)


def by_card(
    db: Session, limit: int = 20, *, user_id: Optional[UUID] = None
) -> List[dict]:
    return transaction_db.aggregate_by_card(db, limit=limit, user_id=user_id)


def by_card_type(db: Session, *, user_id: Optional[UUID] = None) -> List[dict]:
    return transaction_db.aggregate_by_card_type(db, user_id=user_id)


def by_day(
    db: Session, limit: int = 365, *, user_id: Optional[UUID] = None
) -> List[dict]:
    return transaction_db.aggregate_by_day(db, limit=limit, user_id=user_id)


def by_source(db: Session, *, user_id: Optional[UUID] = None) -> dict:
    return transaction_db.aggregate_by_source(db, user_id=user_id)
