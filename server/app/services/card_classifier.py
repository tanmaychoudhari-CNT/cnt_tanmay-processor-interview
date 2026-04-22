"""Card-number normalization + validation.

Single source of truth for "is this a card number we accept?". Every write
path (manual create, bulk create, file upload) runs the input through
`classify_card` before touching the database.
"""
from __future__ import annotations

from app.models.transaction import CARD_TYPES

# 12–20 digits matches the DB column (String(20)) and is wide enough to
# cover every real brand (Amex is 15; V/MC/Discover are 15–16). We also
# enforce a Luhn (mod-10) checksum — the same one card issuers use — so
# transposed or fat-fingered digits fail fast instead of landing in the DB.
MIN_LEN = 12
MAX_LEN = 20


class CardValidationError(ValueError):
    """Raised for any input that can't become a canonical card number."""
    pass


def _luhn_check(digits: str) -> bool:
    """Return True if `digits` (all ASCII 0-9) passes the Luhn checksum.

    Algorithm: walk the number from the rightmost digit. Every second digit
    (positions 2, 4, 6, ... from the right) is doubled; if the double is
    two-digit, its digits are summed (equivalent to subtracting 9). The
    total mod 10 must be zero.
    """
    total = 0
    # `reversed` + enumerate gives us 0-based position from the right, so
    # odd indices correspond to "every second digit" we need to double.
    for i, ch in enumerate(reversed(digits)):
        d = ord(ch) - 48  # ord('0') == 48; faster than int(ch) in a hot path
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def classify_card(card_number: str) -> tuple[str, str]:
    """Normalize and validate the card number.

    Returns (normalized, card_type). `card_type` is inferred from the leading
    digit: 3=Amex, 4=Visa, 5=MasterCard, 6=Discover. Other leaders are rejected.
    Non-digits in the input are stripped; length must fall in [12, 20] (the
    schema allows up to 20 characters); and the number must pass a Luhn
    (mod-10) checksum.
    """
    if card_number is None:
        raise CardValidationError("card_number is required")

    normalized = "".join(ch for ch in str(card_number) if ch.isdigit())
    if not normalized:
        raise CardValidationError("card_number must contain digits")

    if not (MIN_LEN <= len(normalized) <= MAX_LEN):
        raise CardValidationError(
            f"card_number length {len(normalized)} out of range [{MIN_LEN}, {MAX_LEN}]"
        )

    leader = normalized[0]
    if leader not in CARD_TYPES:
        raise CardValidationError(f"unrecognized card type (leading digit '{leader}')")

    if not _luhn_check(normalized):
        raise CardValidationError("card_number fails Luhn checksum")

    return normalized, CARD_TYPES[leader]
