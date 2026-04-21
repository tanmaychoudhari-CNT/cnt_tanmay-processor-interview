"""ORM mapping for the pre-existing `public.transactions` table.

The table is managed outside of this app (created manually via SQL),
so this module must mirror the DDL exactly — names, types, nullability,
and defaults.

Cross-dialect notes:
  * `id` uses the generic `sqlalchemy.Uuid` type so the same model works on
    PostgreSQL (UUID) and SQLite (CHAR(32) hex). The primary-key value is
    generated in Python via `default=uuid.uuid4`, so the server-side
    `gen_random_uuid()` default in the production DDL is just a safety net
    for non-ORM inserts.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Numeric, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


TX_STATUSES = ("success", "failed", "pending")
TX_SOURCES = ("file_upload", "manual_entry")


def _utcnow() -> datetime:
    # Naive UTC — the timestamp columns below are DateTime(timezone=False).
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, nullable=True)

    card_number: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default="success", server_default=text("'success'")
    )
    source: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    transaction_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=_utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=_utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=False),
        nullable=True,
        default=_utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=_utcnow,
    )

    is_deleted: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, default=False, server_default=text("false")
    )


# ---------------------------------------------------------------------------
# Card-type classification is derived on the fly from card_number, since the
# `card_type` column was intentionally dropped from the schema.
# ---------------------------------------------------------------------------

CARD_TYPES = {
    "3": "Amex",
    "4": "Visa",
    "5": "MasterCard",
    "6": "Discover",
}


def derive_card_type(card_number: str) -> str:
    if not card_number:
        return "Unknown"
    return CARD_TYPES.get(card_number[0], "Unknown")
