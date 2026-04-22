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
# "Batch" is the canonical upload source; "file_upload" remains accepted so
# the API can still ingest / filter legacy rows from before the rename.
TxSource = Literal["Batch", "manual_entry", "file_upload"]


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


class TransactionFilters(BaseModel):
    """Query-string model for GET /transactions.

    Centralizes the 15+ filter knobs instead of a huge per-parameter
    signature on the route. FastAPI resolves this via `Depends()` — each
    field becomes a `?field=value` query param with the same validation
    rules (min/max length, pattern, regex) it would have inline.

    `extra="forbid"` rejects unknown query params (e.g. `?pageSize=` vs
    `?page_size=`) with a 422 instead of silently ignoring them — catches
    client typos early.
    """
    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = Field(25, ge=1, le=10000)
    search: Optional[str] = Field(
        None, max_length=64, description="Substring match against card_number"
    )
    card_number: Optional[str] = Field(
        None, max_length=32, description="Exact card_number match"
    )
    sort_by: str = Field("transaction_date", max_length=32)
    sort_dir: str = Field("desc", pattern="^(asc|desc)$")
    card_type: Optional[str] = Field(None, max_length=32)
    source: Optional[str] = Field(None, pattern="^(Batch|manual_entry|file_upload)$")
    # Aliased to `status` in the query string — `status` is a Python
    # builtin so the attribute name uses a trailing underscore.
    status_: Optional[str] = Field(
        None, alias="status", pattern="^(success|failed|pending)$"
    )
    date_from: Optional[datetime] = Field(
        None, description="Inclusive start of transaction_date range"
    )
    date_to: Optional[datetime] = Field(
        None, description="Inclusive end of transaction_date range"
    )
    amount_min: Optional[Decimal] = Field(
        None, description="Inclusive lower bound on amount"
    )
    amount_max: Optional[Decimal] = Field(
        None, description="Inclusive upper bound on amount"
    )
    include_deleted: bool = Field(False)


class TransactionListResponse(BaseModel):
    # Shape of the paginated /transactions response.
    items: List[TransactionOut]
    total: int
    page: int
    page_size: int


class BulkCreateResult(BaseModel):
    # Shape of the /transactions/bulk response. Replaces a loose `dict`
    # generic so the OpenAPI schema is meaningful and clients get real
    # types. `rejected_samples` caps at 5 "<card>: <reason>" strings.
    accepted: int
    rejected: int
    rejected_samples: List[str] = []
