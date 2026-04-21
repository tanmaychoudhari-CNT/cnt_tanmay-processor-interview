from __future__ import annotations

from app.models.transaction import CARD_TYPES

MIN_LEN = 12
MAX_LEN = 20


class CardValidationError(ValueError):
    pass


def classify_card(card_number: str) -> tuple[str, str]:
    """Normalize and validate the card number.

    Returns (normalized, card_type). `card_type` is inferred from the leading
    digit: 3=Amex, 4=Visa, 5=MasterCard, 6=Discover. Other leaders are rejected.
    Non-digits in the input are stripped; length must fall in [12, 20] (the
    schema allows up to 20 characters).
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

    return normalized, CARD_TYPES[leader]
