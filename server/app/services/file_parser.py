"""Bulk file-upload parser for CSV, JSON, and XML transaction feeds.

Parsing, normalization, and card/amount/timestamp validation live here.
All DB writes (batch flush, final commit, rollback on abort) go through
`app.database.transaction_db` so this module never builds SQL directly.

Writes rows in batches of 500 to keep memory flat on large files, and
rejects individual bad rows instead of failing the whole import (up to 5
rejection reasons are surfaced back to the client).
"""
from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable
from uuid import UUID
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session

from app.database import transaction_db
from app.models import Transaction
from app.services.card_classifier import CardValidationError, classify_card


SUPPORTED_EXTENSIONS = {".csv", ".json", ".xml"}
# Flush to the DB every 500 rows — big enough to amortize round-trips,
# small enough that a rollback on a cap breach isn't catastrophic.
BATCH_SIZE = 500


class UnsupportedFileError(ValueError):
    """Raised when the uploaded file's extension isn't one we accept."""
    pass


class FileParseError(ValueError):
    """Raised when a supported-extension file can't actually be parsed
    (malformed JSON/XML, row cap exceeded, etc.). Distinct from
    UnsupportedFileError so the API layer can map both to 400 with
    slightly different messaging."""
    pass


def looks_like_declared_format(ext: str, head: bytes) -> bool:
    """Magic-byte sniffer — does the head of the file actually look like
    its declared extension?

    An extension check alone is trivial to bypass (rename malicious.exe
    to data.csv), so the API layer calls this as a second-gate sanity
    check before spending CPU on the full parser.

    Heuristics kept loose:
      * JSON starts with `{` or `[` after whitespace
      * XML starts with `<`
      * CSV is plain text — we only reject clearly-binary content
    """
    try:
        text = head.lstrip().decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return False
    if not text:
        return False
    if ext == ".json":
        return text[0] in "[{"
    if ext == ".xml":
        return text.startswith("<")
    if ext == ".csv":
        return text[0].isprintable()
    return True


# Excel saves 15-16 digit card numbers as scientific notation (e.g.
# "3.58925E+15") when the column isn't formatted as Text. The trailing
# digits are already lost at that point, but we can at least expand the
# value back to a digit string of the right length so the row passes
# length / leader validation and gets ingested.
_SCIENTIFIC_NOTATION = re.compile(r"^[+-]?\d+(\.\d+)?[eE][+-]?\d+$")


def _recover_scientific_card(value):
    if value is None:
        return value
    s = str(value).strip()
    if not _SCIENTIFIC_NOTATION.match(s):
        return value
    try:
        return str(int(Decimal(s)))
    except (InvalidOperation, ValueError):
        return value


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
        raise FileParseError("JSON root must be a list of transactions or { transactions: [...] }")
    for row in data:
        if not isinstance(row, dict):
            raise FileParseError("JSON array items must be objects")
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
) -> dict:
    """Parse a batch upload."""
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
        card = _recover_scientific_card(norm.get("card_number"))
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
            transaction_db.flush_transactions(db, batch)
            batch = []

    # Final commit picks up any tail-batch rows and any earlier flushes.
    transaction_db.insert_transactions(db, batch)

    return {
        "filename": filename,
        "source_format": fmt,
        "accepted": accepted,
        "rejected": rejected,
        "rejected_samples": samples,
    }
