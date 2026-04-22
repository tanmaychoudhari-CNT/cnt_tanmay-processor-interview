"""Performance-index DDL for the `transactions` table.

The `transactions` table is owned outside this app (created manually via
SQL), so we don't manage its schema — but we do ensure the indexes the
hot-path queries rely on are present. These run at startup and are
idempotent (`CREATE INDEX IF NOT EXISTS`).

Kept out of `main.py` so the list of SQL statements lives with other
database-layer code rather than mingled with middleware + lifespan
plumbing.
"""
from sqlalchemy import text
from sqlalchemy.engine import Engine


# Indexes we want on the user-managed `public.transactions` table.
# Applied via CREATE INDEX IF NOT EXISTS so it's safe to run on every boot.
PERFORMANCE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions (status)",
    "CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions (source)",
    "CREATE INDEX IF NOT EXISTS idx_tx_is_deleted ON transactions (is_deleted)",
    "CREATE INDEX IF NOT EXISTS idx_tx_card_number ON transactions (card_number)",
    "CREATE INDEX IF NOT EXISTS idx_tx_transaction_date ON transactions (transaction_date DESC)",
    # Hot-path list query: "my active rows, newest first"
    "CREATE INDEX IF NOT EXISTS idx_tx_user_active_date ON transactions (user_id, is_deleted, transaction_date DESC)",
]


def ensure_performance_indexes(engine: Engine) -> None:
    """Apply every `CREATE INDEX IF NOT EXISTS` against the bound engine.

    Skips SQLite (used only in tests) — the syntax is Postgres-specific
    enough that cross-dialect execution would need per-dialect variants,
    and the tests don't care about query plans.
    """
    if engine.dialect.name == "sqlite":
        return
    with engine.begin() as conn:
        for sql in PERFORMANCE_INDEXES:
            conn.execute(text(sql))
