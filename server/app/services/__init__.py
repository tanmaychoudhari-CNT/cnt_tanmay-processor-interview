"""Re-exports so API routes can `from app.services import foo` without
knowing which submodule each helper lives in. This is pure plumbing — no
logic should live here."""
from .card_classifier import classify_card, CardValidationError
from .auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    authenticate_user,
    ensure_seed_admin,
    validate_password_strength,
    WeakPasswordError,
)
from .transaction_service import (
    create_transaction,
    create_transactions_bulk,
    update_transaction,
    delete_transaction,
    restore_transaction,
    get_transaction,
    list_transactions,
    summary,
    by_card,
    by_card_type,
    by_day,
)
from .file_parser import parse_upload

__all__ = [
    "classify_card",
    "CardValidationError",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_token",
    "authenticate_user",
    "ensure_seed_admin",
    "validate_password_strength",
    "WeakPasswordError",
    "create_transaction",
    "create_transactions_bulk",
    "update_transaction",
    "delete_transaction",
    "restore_transaction",
    "get_transaction",
    "list_transactions",
    "summary",
    "by_card",
    "by_card_type",
    "by_day",
    "parse_upload",
]
