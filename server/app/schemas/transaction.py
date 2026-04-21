from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models.transaction import derive_card_type


TxStatus = Literal["success", "failed", "pending"]
TxSource = Literal["file_upload", "manual_entry"]


def _normalize_card(v: str) -> str:
    v = "".join(ch for ch in v if ch.isdigit())
    if not v:
        raise ValueError("card_number must contain digits")
    return v


class TransactionBase(BaseModel):
    card_number: str = Field(..., min_length=12, max_length=20)
    amount: Decimal
    transaction_date: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        return _normalize_card(v)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    card_number: Optional[str] = Field(None, min_length=12, max_length=20)
    amount: Optional[Decimal] = None
    transaction_date: Optional[datetime] = None
    status: Optional[TxStatus] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        return None if v is None else _normalize_card(v)


class TransactionOut(BaseModel):
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
        return derive_card_type(self.card_number)


class ManualEntry(BaseModel):
    card_number: str = Field(..., min_length=12, max_length=20)
    amount: Decimal
    transaction_date: Optional[datetime] = None
    remarks: Optional[str] = Field(None, max_length=4000)

    @field_validator("card_number")
    @classmethod
    def _card(cls, v):
        return _normalize_card(v)


class ManualBulkRequest(BaseModel):
    items: List[ManualEntry] = Field(..., min_length=1, max_length=500)


class TransactionListResponse(BaseModel):
    items: List[TransactionOut]
    total: int
    page: int
    page_size: int
