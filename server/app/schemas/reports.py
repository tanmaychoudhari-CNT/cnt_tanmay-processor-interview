from datetime import date
from decimal import Decimal
from typing import List

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total_entries: int
    total_amount: Decimal
    average_amount: Decimal
    highest_amount: Decimal
    lowest_amount: Decimal
    deleted_count: int


class ByCardItem(BaseModel):
    card_number: str
    card_type: str
    total_amount: Decimal
    count: int


class ByCardTypeItem(BaseModel):
    card_type: str
    total_amount: Decimal
    count: int


class ByDayItem(BaseModel):
    day: date
    total_amount: Decimal
    count: int


class UploadResult(BaseModel):
    filename: str
    source_format: str
    accepted: int
    rejected: int
    rejected_samples: List[str] = []
