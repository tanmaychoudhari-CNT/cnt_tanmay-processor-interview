from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import and_, asc, case, desc, func, select
from sqlalchemy.orm import Session

from app.models import Transaction
from app.models.transaction import TX_SOURCES, TX_STATUSES, CARD_TYPES
from app.schemas.transaction import ManualEntry, TransactionCreate, TransactionUpdate
from app.services.card_classifier import CardValidationError, classify_card


SORTABLE_FIELDS = {
    "amount": Transaction.amount,
    "transaction_date": Transaction.transaction_date,
    "transaction_timestamp": Transaction.transaction_date,  # legacy alias
    "created_at": Transaction.created_at,
    "card_number": Transaction.card_number,
}


def _card_type_case():
    """SQL expression that maps the leading card-number digit to a brand.

    Uses `substr()` which is portable across PostgreSQL and SQLite.
    """
    leading = func.substr(Transaction.card_number, 1, 1)
    whens = [(leading == k, v) for k, v in CARD_TYPES.items()]
    return case(*whens, else_="Unknown")


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
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def create_transactions_bulk(
    db: Session,
    items: Iterable[TransactionCreate | ManualEntry],
    *,
    user_id: UUID,
    source: str = "manual_entry",
    file_name: Optional[str] = None,
) -> tuple[int, int, list[str]]:
    _validate_source(source)
    accepted = 0
    rejected = 0
    samples: list[str] = []
    batch: list[Transaction] = []

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

    if batch:
        db.add_all(batch)
    db.commit()
    return accepted, rejected, samples


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


def _scope_filter(user_id: Optional[UUID], include_deleted: bool = False):
    clauses = []
    if not include_deleted:
        clauses.append(
            (Transaction.is_deleted.is_(False)) | (Transaction.is_deleted.is_(None))
        )
    if user_id is not None:
        clauses.append(Transaction.user_id == user_id)
    return and_(*clauses) if clauses else None


def get_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> Optional[Transaction]:
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    return db.scalar(stmt)


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
) -> tuple[list[Transaction], int]:
    page = max(1, page)
    page_size = max(1, min(page_size, 10000))

    filters = []
    if not include_deleted:
        filters.append(
            (Transaction.is_deleted.is_(False)) | (Transaction.is_deleted.is_(None))
        )
    if user_id is not None:
        filters.append(Transaction.user_id == user_id)

    if search:
        digits = "".join(ch for ch in search if ch.isdigit())
        if digits:
            filters.append(Transaction.card_number.like(f"%{digits}%"))

    if card_number:
        digits = "".join(ch for ch in card_number if ch.isdigit())
        if digits:
            filters.append(Transaction.card_number == digits)

    if card_type:
        # Reverse-lookup: map "Visa" → leading digit "4" etc.
        leader = next((k for k, v in CARD_TYPES.items() if v == card_type), None)
        if leader:
            filters.append(Transaction.card_number.like(f"{leader}%"))

    if source:
        filters.append(Transaction.source == source)
    if status:
        filters.append(Transaction.status == status)

    if date_from is not None:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to is not None:
        filters.append(Transaction.transaction_date <= date_to)

    if amount_min is not None:
        filters.append(Transaction.amount >= amount_min)
    if amount_max is not None:
        filters.append(Transaction.amount <= amount_max)

    stmt = select(Transaction)
    count_stmt = select(func.count(Transaction.id))
    if filters:
        where = and_(*filters)
        stmt = stmt.where(where)
        count_stmt = count_stmt.where(where)

    sort_col = SORTABLE_FIELDS.get(sort_by, Transaction.transaction_date)
    order = desc(sort_col) if sort_dir.lower() == "desc" else asc(sort_col)
    stmt = stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)

    items = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0
    return items, total


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
    txn = get_transaction(db, transaction_id, user_id=user_id)
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

    db.commit()
    db.refresh(txn)
    return txn


# ---------------------------------------------------------------------------
# Soft delete + restore
# ---------------------------------------------------------------------------


def delete_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> bool:
    txn = get_transaction(db, transaction_id, user_id=user_id)
    if not txn:
        return False
    txn.is_deleted = True
    db.commit()
    return True


def restore_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> bool:
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    if user_id is not None:
        stmt = stmt.where(Transaction.user_id == user_id)
    txn = db.scalar(stmt)
    if not txn or not txn.is_deleted:
        return False
    txn.is_deleted = False
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Reports — scoped to the caller, exclude soft-deleted rows.
# ---------------------------------------------------------------------------


def summary(db: Session, *, user_id: Optional[UUID] = None) -> dict:
    active = _scope_filter(user_id, include_deleted=False)
    deleted_filter = and_(Transaction.is_deleted.is_(True), Transaction.user_id == user_id) if user_id else Transaction.is_deleted.is_(True)

    total_entries_q = select(func.count(Transaction.id))
    total_amount_q = select(func.coalesce(func.sum(Transaction.amount), 0))
    avg_q = select(func.coalesce(func.avg(Transaction.amount), 0))
    hi_q = select(func.coalesce(func.max(Transaction.amount), 0))
    lo_q = select(func.coalesce(func.min(Transaction.amount), 0))
    for q in (total_entries_q, total_amount_q, avg_q, hi_q, lo_q):
        pass  # no-op; we re-bind below
    if active is not None:
        total_entries_q = total_entries_q.where(active)
        total_amount_q = total_amount_q.where(active)
        avg_q = avg_q.where(active)
        hi_q = hi_q.where(active)
        lo_q = lo_q.where(active)

    deleted_count = db.scalar(
        select(func.count(Transaction.id)).where(deleted_filter)
    ) or 0

    return {
        "total_entries": db.scalar(total_entries_q) or 0,
        "total_amount": Decimal(db.scalar(total_amount_q) or 0).quantize(Decimal("0.01")),
        "average_amount": Decimal(db.scalar(avg_q) or 0).quantize(Decimal("0.01")),
        "highest_amount": Decimal(db.scalar(hi_q) or 0).quantize(Decimal("0.01")),
        "lowest_amount": Decimal(db.scalar(lo_q) or 0).quantize(Decimal("0.01")),
        "deleted_count": deleted_count,
    }


def by_card(db: Session, limit: int = 20, *, user_id: Optional[UUID] = None) -> list[dict]:
    card_type_expr = _card_type_case().label("card_type")
    stmt = select(
        Transaction.card_number,
        card_type_expr,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("count"),
    )
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    stmt = (
        stmt.group_by(Transaction.card_number)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )
    return [
        {
            "card_number": row.card_number,
            "card_type": row.card_type,
            "total_amount": Decimal(row.total_amount).quantize(Decimal("0.01")),
            "count": row.count,
        }
        for row in db.execute(stmt).all()
    ]


def by_card_type(db: Session, *, user_id: Optional[UUID] = None) -> list[dict]:
    card_type_expr = _card_type_case().label("card_type")
    stmt = select(
        card_type_expr,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("count"),
    )
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    stmt = stmt.group_by(card_type_expr).order_by(card_type_expr)
    return [
        {
            "card_type": row.card_type,
            "total_amount": Decimal(row.total_amount).quantize(Decimal("0.01")),
            "count": row.count,
        }
        for row in db.execute(stmt).all()
    ]


def by_day(db: Session, limit: int = 365, *, user_id: Optional[UUID] = None) -> list[dict]:
    day_col = func.date(Transaction.transaction_date).label("day")
    stmt = select(
        day_col,
        func.sum(Transaction.amount).label("total_amount"),
        func.count(Transaction.id).label("count"),
    )
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    stmt = stmt.group_by(day_col).order_by(day_col).limit(limit)
    return [
        {
            "day": row.day,
            "total_amount": Decimal(row.total_amount).quantize(Decimal("0.01")),
            "count": row.count,
        }
        for row in db.execute(stmt).all()
    ]
