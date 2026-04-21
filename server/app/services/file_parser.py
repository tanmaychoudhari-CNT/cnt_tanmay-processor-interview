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
) -> dict:
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

    for raw in rows:
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
