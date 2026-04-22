"""Bulk file-upload parser for CSV, JSON, and XML transaction feeds.

Writes rows in batches of 500 to keep memory flat on large files, and
rejects individual bad rows instead of failing the whole import (up to 5
rejection reasons are surfaced back to the client).
"""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable
from uuid import UUID
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session

from app.models import Transaction
from app.services.card_classifier import CardValidationError, classify_card


SUPPORTED_EXTENSIONS = {".csv", ".json", ".xml"}
# Flush to the DB every 500 rows — big enough to amortize round-trips,
# small enough that a rollback on a cap breach isn't catastrophic.
BATCH_SIZE = 500


class UnsupportedFileError(ValueError):
    pass


def _to_decimal(value) -> Decimal:
    if value is None or value == "":
        raise ValueError("amount is required")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as e:
        raise ValueError(f"invalid amount '{value}'") from e


def _to_datetime(value) -> datetime:
    if value is None or value == "":
        raise ValueError("timestamp is required")
    s = str(value).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as e:
        raise ValueError(f"invalid timestamp '{s}'") from e


def _iter_csv(content: bytes) -> Iterable[dict]:
    # utf-8-sig strips the Excel-style BOM so the first header field doesn't
    # arrive as "﻿card_number" and miss the key-normalization step.
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        yield row


def _iter_json(content: bytes) -> Iterable[dict]:
    data = json.loads(content.decode("utf-8"))
    if isinstance(data, dict) and "transactions" in data:
        data = data["transactions"]
    if not isinstance(data, list):
        raise ValueError("JSON root must be a list of transactions or { transactions: [...] }")
    for row in data:
        if not isinstance(row, dict):
            raise ValueError("JSON array items must be objects")
        yield row


def _iter_xml(content: bytes) -> Iterable[dict]:
    root = ET.fromstring(content)
    for txn in root.findall(".//transaction"):
        yield {child.tag: (child.text or "").strip() for child in txn}


def _normalize_keys(row: dict) -> dict:
    """Coerce a row's keys into the three canonical fields we care about.

    We accept a wide variety of casings and separators ("CardNumber",
    "card-number", "CARD_NUMBER") because real feeds in the wild are
    inconsistent. Strip `_` and `-` and lowercase to do the match.
    """
    mapping = {}
    for key, val in row.items():
        lk = str(key).strip()
        low = lk.lower().replace("_", "").replace("-", "")
        if low in ("cardnumber", "card"):
            mapping["card_number"] = val
        elif low in ("amount", "value"):
            mapping["amount"] = val
        elif low in ("timestamp", "time", "date", "createdat", "transactionsdate", "transactiondate"):
            mapping["timestamp"] = val
    return mapping


def parse_upload(
    db: Session,
    filename: str,
    content: bytes,
    *,
    user_id: UUID,
    max_rows: int | None = None,
) -> dict:
    """Parse a batch upload.

    max_rows: hard cap on rows consumed from the file. If the file contains
    more rows than this, we raise a ValueError so the API can return 413.
    This prevents a crafted 10M-row CSV from ballooning the database.
    """
    lower = filename.lower()
    if lower.endswith(".csv"):
        fmt, rows = "csv", _iter_csv(content)
    elif lower.endswith(".json"):
        fmt, rows = "json", _iter_json(content)
    elif lower.endswith(".xml"):
        fmt, rows = "xml", _iter_xml(content)
    else:
        raise UnsupportedFileError(f"unsupported file extension for '{filename}'")

    accepted = 0
    rejected = 0
    samples: list[str] = []
    batch: list[Transaction] = []
    seen = 0

    for raw in rows:
        seen += 1
        if max_rows is not None and seen > max_rows:
            # Abort — the caller asked for a cap. Roll back anything we
            # already flushed into the session so we don't half-commit.
            db.rollback()
            raise ValueError(
                f"file exceeds the {max_rows}-row limit (aborted at row {seen})"
            )

        norm = _normalize_keys(raw)
        card = norm.get("card_number")
        amount_raw = norm.get("amount")
        ts_raw = norm.get("timestamp")

        try:
            normalized, _ = classify_card(card)
            amount = _to_decimal(amount_raw)
            ts = _to_datetime(ts_raw)
        except (CardValidationError, ValueError) as err:
            rejected += 1
            if len(samples) < 5:
                samples.append(f"{card}: {err}")
            continue

        batch.append(
            Transaction(
                user_id=user_id,
                status="success",
                source="file_upload",
                file_name=filename,
                card_number=normalized,
                amount=amount,
                transaction_date=ts,
            )
        )
        accepted += 1

        if len(batch) >= BATCH_SIZE:
            db.add_all(batch)
            db.flush()
            batch = []

    if batch:
        db.add_all(batch)
    db.commit()

    return {
        "filename": filename,
        "source_format": fmt,
        "accepted": accepted,
        "rejected": rejected,
        "rejected_samples": samples,
    }
