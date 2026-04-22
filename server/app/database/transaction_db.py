"""DB operations for the `transactions` table.

Every SELECT/INSERT/UPDATE/DELETE against `transactions` lives here. The
service layer calls these functions and never builds queries inline — that
keeps the user-scoping + soft-delete rules in one place where they can't
be accidentally bypassed by a new code path.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, asc, case, desc, func, select
from sqlalchemy.orm import Session

from app.models import Transaction
from app.models.transaction import CARD_TYPES


# Allow-list of columns the client can sort by. Falls back to
# `transaction_date` for unknown values — prevents arbitrary-column sort
# injection via the ?sort_by= query string.
SORTABLE_FIELDS = {
    "amount": Transaction.amount,
    "transaction_date": Transaction.transaction_date,
    "transaction_timestamp": Transaction.transaction_date,  # legacy alias
    "created_at": Transaction.created_at,
    "card_number": Transaction.card_number,
}


def _card_type_case():
    """SQL CASE expression that maps the leading card-number digit to a brand.

    Uses `substr()` which is portable across PostgreSQL and SQLite.
    """
    leading = func.substr(Transaction.card_number, 1, 1)
    whens = [(leading == k, v) for k, v in CARD_TYPES.items()]
    return case(*whens, else_="Unknown")


def _scope_filter(user_id: Optional[UUID], include_deleted: bool = False):
    """Compose the common "visible to this user" WHERE clause.

    `is_deleted` check is written as `(False) OR (NULL)` because legacy rows
    inserted before the soft-delete column existed have NULL in that slot —
    they should still be visible as active.
    """
    clauses = []
    if not include_deleted:
        clauses.append(
            (Transaction.is_deleted.is_(False)) | (Transaction.is_deleted.is_(None))
        )
    if user_id is not None:
        clauses.append(Transaction.user_id == user_id)
    return and_(*clauses) if clauses else None


# ---------------------------------------------------------------------------
# Insert
# ---------------------------------------------------------------------------


def insert_transaction(db: Session, txn: Transaction) -> Transaction:
    """Persist a single transaction row and refresh it so server defaults
    are populated on the returned instance."""
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def insert_transactions(db: Session, txns: List[Transaction]) -> None:
    """Stage a batch of rows and commit. No-op if the batch is empty
    (still commits any rows already flushed earlier in the transaction)."""
    if txns:
        db.add_all(txns)
    db.commit()


def flush_transactions(db: Session, txns: List[Transaction]) -> None:
    """Stage a batch and flush to the DB without committing — used between
    batches in a streaming bulk import to keep memory flat."""
    db.add_all(txns)
    db.flush()


def rollback(db: Session) -> None:
    """Roll back the in-flight transaction. Used when a streaming import
    aborts mid-way and we need to discard already-flushed rows."""
    db.rollback()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_transaction(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> Optional[Transaction]:
    """Fetch a single active transaction scoped to the given user.

    Soft-deleted rows are excluded — use `get_transaction_including_deleted`
    when you need to look at a row regardless of its deletion state (e.g.
    the restore flow).
    """
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    return db.scalar(stmt)


def get_transaction_including_deleted(
    db: Session, transaction_id: UUID, *, user_id: Optional[UUID] = None
) -> Optional[Transaction]:
    """Like `get_transaction` but also returns soft-deleted rows. Used by
    the restore flow which needs to look at `is_deleted=True` records."""
    stmt = select(Transaction).where(Transaction.id == transaction_id)
    if user_id is not None:
        stmt = stmt.where(Transaction.user_id == user_id)
    return db.scalar(stmt)


def list_transactions(
    db: Session,
    *,
    user_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 25,
    search_digits: Optional[str] = None,
    card_number: Optional[str] = None,
    sort_by: str = "transaction_date",
    sort_dir: str = "desc",
    card_leading_digit: Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    amount_min: Optional[Decimal] = None,
    amount_max: Optional[Decimal] = None,
    include_deleted: bool = False,
) -> Tuple[List[Transaction], int]:
    """Paginated, sorted, filtered list of transactions.

    All filter arguments are pre-normalized values from the service layer
    (e.g. `search_digits` is already digits-only, `card_leading_digit` has
    been resolved from a brand name). Keeping the normalization out of here
    means this function stays a pure SQL builder.
    """
    filters = []
    if not include_deleted:
        filters.append(
            (Transaction.is_deleted.is_(False)) | (Transaction.is_deleted.is_(None))
        )
    if user_id is not None:
        filters.append(Transaction.user_id == user_id)

    if search_digits:
        filters.append(Transaction.card_number.like(f"%{search_digits}%"))
    if card_number:
        filters.append(Transaction.card_number == card_number)
    if card_leading_digit:
        filters.append(Transaction.card_number.like(f"{card_leading_digit}%"))
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
# Update / soft-delete
# ---------------------------------------------------------------------------


def save_transaction(db: Session, txn: Transaction) -> Transaction:
    """Commit in-memory mutations to a managed Transaction instance and
    refresh it so any DB-side `onupdate` columns (e.g. `updated_at`) are
    reflected on the returned object."""
    db.commit()
    db.refresh(txn)
    return txn


def soft_delete_transaction(db: Session, txn: Transaction) -> None:
    """Flip `is_deleted` on the row and commit — the row stays in the table
    so it can be restored later."""
    txn.is_deleted = True
    db.commit()


def restore_transaction_row(db: Session, txn: Transaction) -> None:
    """Inverse of `soft_delete_transaction` — clear `is_deleted` and commit."""
    txn.is_deleted = False
    db.commit()


# ---------------------------------------------------------------------------
# Aggregations / report queries
# ---------------------------------------------------------------------------


def aggregate_summary(db: Session, *, user_id: Optional[UUID] = None) -> dict:
    """Headline KPI aggregation: total entries, total/avg/hi/lo amount, and
    a separate count of soft-deleted rows so the UI can offer a restore
    affordance without a second round-trip.
    """
    active = _scope_filter(user_id, include_deleted=False)
    deleted_filter = (
        and_(Transaction.is_deleted.is_(True), Transaction.user_id == user_id)
        if user_id
        else Transaction.is_deleted.is_(True)
    )

    # COALESCE(...,0) so the SQL engine returns 0 instead of NULL when the
    # table is empty — saves a conditional in Python.
    total_entries_q = select(func.count(Transaction.id))
    total_amount_q = select(func.coalesce(func.sum(Transaction.amount), 0))
    avg_q = select(func.coalesce(func.avg(Transaction.amount), 0))
    hi_q = select(func.coalesce(func.max(Transaction.amount), 0))
    lo_q = select(func.coalesce(func.min(Transaction.amount), 0))
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


def aggregate_by_card(
    db: Session, *, limit: int = 20, user_id: Optional[UUID] = None
) -> List[dict]:
    """Top cards by total volume — powers the "Top cards" insights panel."""
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


def aggregate_by_card_type(
    db: Session, *, user_id: Optional[UUID] = None
) -> List[dict]:
    """Volume + count grouped by card brand — powers the dashboard donut."""
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


def aggregate_by_source(db: Session, *, user_id: Optional[UUID] = None) -> dict:
    """Count active rows grouped by `source` (Batch vs manual_entry).

    Returns a flat dict so the API can serialize it without a list of two
    items — the UI only ever cares about these two buckets. Rows with a
    NULL source (legacy / pre-source data) are bucketed as "unknown".

    "Batch" is the canonical upload source; the legacy "file_upload" value
    is also counted as upload so rows inserted before the rename still
    appear in the Batch totals without requiring a data migration.
    """
    stmt = select(
        Transaction.source,
        func.count(Transaction.id).label("count"),
    )
    f = _scope_filter(user_id)
    if f is not None:
        stmt = stmt.where(f)
    stmt = stmt.group_by(Transaction.source)

    upload = 0
    manual = 0
    unknown = 0
    for row in db.execute(stmt).all():
        if row.source in ("Batch", "file_upload"):
            upload += row.count
        elif row.source == "manual_entry":
            manual += row.count
        else:
            unknown += row.count
    return {"upload": upload, "manual": manual, "unknown": unknown}


def aggregate_by_day(
    db: Session, *, limit: int = 365, user_id: Optional[UUID] = None
) -> List[dict]:
    """Daily volume series — powers the trend/area chart."""
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
