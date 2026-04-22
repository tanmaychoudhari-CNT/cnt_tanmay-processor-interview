"""Pure-function tests for model helpers and the file parser."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest

from app.models.transaction import CARD_TYPES, derive_card_type
from app.services.file_parser import (
    UnsupportedFileError,
    _iter_csv,
    _iter_json,
    _iter_xml,
    _normalize_keys,
    _to_datetime,
    _to_decimal,
    parse_upload,
)


class TestDeriveCardType:
    @pytest.mark.parametrize(
        "card, expected",
        [
            ("4267628872390354", "Visa"),
            ("5553959204036898", "MasterCard"),
            ("6714744990978279", "Discover"),
            ("3336208249795483", "Amex"),
            ("0000000000000000", "Unknown"),
            ("", "Unknown"),
        ],
    )
    def test_by_leading_digit(self, card, expected):
        assert derive_card_type(card) == expected

    def test_all_mapped_brands_have_leader(self):
        # Spec sanity: 4 brand entries, one per leading digit.
        assert CARD_TYPES == {"3": "Amex", "4": "Visa", "5": "MasterCard", "6": "Discover"}


class TestToDecimal:
    @pytest.mark.parametrize(
        "raw, expected",
        [
            ("100", Decimal("100")),
            ("-42.50", Decimal("-42.50")),
            (0, Decimal("0")),
            ("0.01", Decimal("0.01")),
        ],
    )
    def test_parses_numeric(self, raw, expected):
        assert _to_decimal(raw) == expected

    @pytest.mark.parametrize("raw", [None, ""])
    def test_missing_raises(self, raw):
        with pytest.raises(ValueError, match="required"):
            _to_decimal(raw)

    def test_garbage_raises(self):
        with pytest.raises(ValueError, match="invalid amount"):
            _to_decimal("not-a-number")


class TestToDatetime:
    def test_iso_datetime_round_trip(self):
        dt = _to_datetime("2024-05-21T15:26:44.759901")
        assert dt == datetime(2024, 5, 21, 15, 26, 44, 759901)

    def test_z_suffix_becomes_naive(self):
        dt = _to_datetime("2024-05-21T15:26:44Z")
        assert dt.tzinfo is None  # app stores naive datetimes
        assert dt.year == 2024 and dt.month == 5 and dt.day == 21

    def test_date_only(self):
        dt = _to_datetime("2024-05-21")
        assert dt == datetime(2024, 5, 21, 0, 0, 0)

    @pytest.mark.parametrize("raw", [None, "", "not-a-date"])
    def test_bad_input_raises(self, raw):
        with pytest.raises(ValueError):
            _to_datetime(raw)


class TestNormalizeKeys:
    def test_snake_case(self):
        assert _normalize_keys({"card_number": "x", "amount": 1, "timestamp": "t"}) == {
            "card_number": "x",
            "amount": 1,
            "timestamp": "t",
        }

    def test_camel_case(self):
        assert _normalize_keys({"cardNumber": "x", "Amount": 2, "transactionDate": "t"}) == {
            "card_number": "x",
            "amount": 2,
            "timestamp": "t",
        }

    def test_unknown_keys_ignored(self):
        assert _normalize_keys({"foo": "bar", "card_number": "x"}) == {"card_number": "x"}


class TestFileIterators:
    def test_csv_header_row_drives_keys(self):
        content = b"cardNumber,timestamp,amount\n4267628872390354,2024-01-01T00:00:00,10\n"
        rows = list(_iter_csv(content))
        assert rows == [
            {"cardNumber": "4267628872390354", "timestamp": "2024-01-01T00:00:00", "amount": "10"}
        ]

    def test_csv_utf8_bom_stripped(self):
        content = b"\xef\xbb\xbfcardNumber,amount\n4267628872390354,10\n"
        rows = list(_iter_csv(content))
        assert rows[0]["cardNumber"] == "4267628872390354"

    def test_json_array(self):
        content = b'[{"cardNumber":"4267628872390354","amount":10,"timestamp":"2024-01-01"}]'
        rows = list(_iter_json(content))
        assert rows[0]["cardNumber"] == "4267628872390354"

    def test_json_wrapped(self):
        content = b'{"transactions":[{"cardNumber":"4267628872390354","amount":10,"timestamp":"2024-01-01"}]}'
        rows = list(_iter_json(content))
        assert len(rows) == 1

    def test_json_invalid_shape_raises(self):
        with pytest.raises(ValueError):
            list(_iter_json(b'"just-a-string"'))

    def test_xml(self):
        content = (
            b"<transactions><transaction>"
            b"<cardNumber>4267628872390354</cardNumber>"
            b"<amount>10</amount>"
            b"<timestamp>2024-01-01T00:00:00</timestamp>"
            b"</transaction></transactions>"
        )
        rows = list(_iter_xml(content))
        assert rows == [
            {
                "cardNumber": "4267628872390354",
                "amount": "10",
                "timestamp": "2024-01-01T00:00:00",
            }
        ]


class TestParseUpload:
    CSV = (
        b"cardNumber,timestamp,amount\n"
        b"4267628872390354,2024-01-01T00:00:00,100.00\n"
        b"5553959204036898,2024-01-02T00:00:00,-50.00\n"
        b"BADCARD,2024-01-03T00:00:00,10\n"   # invalid card — should be rejected
        b"4267628872390354,not-a-date,10\n"     # invalid timestamp — rejected
    )

    def test_accepts_valid_rejects_invalid(self, db_session):
        import uuid

        result = parse_upload(
            db_session,
            "test.csv",
            self.CSV,
            user_id=uuid.uuid4(),
        )
        assert result["accepted"] == 2
        assert result["rejected"] == 2
        assert result["source_format"] == "csv"
        assert len(result["rejected_samples"]) == 2

    def test_unsupported_extension_raises(self, db_session):
        import uuid

        with pytest.raises(UnsupportedFileError):
            parse_upload(db_session, "file.txt", b"", user_id=uuid.uuid4())
