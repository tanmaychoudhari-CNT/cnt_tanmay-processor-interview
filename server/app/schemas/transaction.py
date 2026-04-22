"""Pydantic DTOs for transaction CRUD + bulk manual entry.

Card numbers are always normalized to digits-only at the DTO boundary so
downstream code never has to care about spaces / hyphens / separators.
`card_type` is a computed field — derived from the leading digit rather
than stored, because the legacy schema dropped that column.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models.transaction import derive_card_type


TxStatus = Literal["success", "failed", "pending"]
TxSource = Literal["file_upload", "manual_entry"]


def _normalize_card(v: str) -> str:
    # Accept "4111 1111 1111 1111", "4111-1111-1111-1111", etc. Strip
    # everything non-digit so downstream code sees a clean number.
    v = "".join(ch for ch in v if ch.isdigit())
    if not v:
        raise ValueError("card_number must contain digits")
    return v


class TransactionBase(BaseModel):
    # Length bounds match the DB column (String(20)). The classifier in
    # services/card_classifier.py enforces the tighter 12–20 digit window
    # and rejects unknown leading digits — this is just a cheap first gate.
    card_number: str = Field(..., min_length=12, max_length=20)
    amount: Decimal
    transaction_date: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        return _normalize_card(v)


class TransactionCreate(TransactionBase):
    # No extra fields — POST /transactions accepts the same shape as base.
    pass


class TransactionUpdate(BaseModel):
    # All fields optional: PATCH semantics via PUT — the service layer only
    # touches fields that were explicitly provided (not None).
    card_number: Optional[str] = Field(None, min_length=12, max_length=20)
    amount: Optional[Decimal] = None
    transaction_date: Optional[datetime] = None
    status: Optional[TxStatus] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        # Passing null explicitly should clear the field, not fail validation.
        return None if v is None else _normalize_card(v)


class TransactionOut(BaseModel):
    # `from_attributes=True` accepts the ORM Transaction object directly.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID]
    card_number: str
    amount: Decimal
    transaction_date: Optional[datetime]
    status: Optional[str]
    source: Optional[str]
    file_name: Optional[str]
    remarks: Optional[str]
    is_deleted: Optional[bool]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    @computed_field  # type: ignore[misc]
    @property
    def card_type(self) -> str:
        # Derived, not stored — keeps the DB schema lean. Leading digit
        # 3/4/5/6 → Amex/Visa/MasterCard/Discover.
        return derive_card_type(self.card_number)


class ManualEntry(BaseModel):
    # A single row in the bulk-submit body. Near-duplicate of
    # TransactionCreate but without inheritance to decouple the two shapes —
    # /transactions/bulk can diverge over time without breaking the single-
    # item endpoint.
    card_number: str = Field(..., min_length=12, max_length=20)
    amount: Decimal
    transaction_date: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        return _normalize_card(v)


class ManualBulkRequest(BaseModel):
    # Cap at 500 per call — any more and the client should use file upload.
    # Keeping this tight protects the server from pathological batch sizes.
    items: List[ManualEntry] = Field(..., min_length=1, max_length=500)


class TransactionListResponse(BaseModel):
    # Shape of the paginated /transactions response.
    items: List[TransactionOut]
    total: int
    page: int
    page_size: int
