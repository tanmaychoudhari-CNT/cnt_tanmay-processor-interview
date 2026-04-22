"""ORM mapping for the `users` table.

The table is auto-created by `Base.metadata.create_all()` on app startup —
unlike `transactions`, which is managed externally. The seed admin user is
inserted lazily by `ensure_seed_admin` if the table is empty.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    # Naive UTC — matches the DB columns (DateTime without tz).
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=_utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
