"""Pydantic DTOs for the /reports/* aggregation endpoints.

Amounts use `Decimal` (not float) because SUM/AVG over currency must not
lose precision — Pydantic will serialize them as strings, which matches
what the frontend expects.
"""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    # Mirrors the keys produced by `services.transaction_service.summary`.
    total_entries: int
    total_amount: Decimal
    average_amount: Decimal
    highest_amount: Decimal
    lowest_amount: Decimal
    deleted_count: int


class ByCardItem(BaseModel):
    # One row per distinct card number in the /reports/by-card response.
    card_number: str
    card_type: str
    total_amount: Decimal
    count: int


class ByCardTypeItem(BaseModel):
    # One row per card brand (Visa / MasterCard / Amex / Discover / Unknown).
    card_type: str
    total_amount: Decimal
    count: int


class ByDayItem(BaseModel):
    # One row per calendar day — aggregated in SQL with `date(transaction_date)`.
    day: date
    total_amount: Decimal
    count: int


class BySourceResponse(BaseModel):
    # Real-time source split — counts of active rows whose `source` is
    # Batch vs manual_entry. `unknown` covers legacy rows where the
    # column is NULL so the totals always reconcile with summary.total_entries.
    upload: int
    manual: int
    unknown: int
    total: int
