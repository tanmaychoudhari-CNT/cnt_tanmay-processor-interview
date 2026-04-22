"""Shared response envelope.

Every successful API response comes back as `StandardResponse[T]` —
`{ success: true, data: ..., message: ... }`. The client's axios `unwrap`
helper strips the envelope so callers get `data` directly. Errors don't
use this shape; they fall back to FastAPI's default `{ detail: ... }`.
"""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
