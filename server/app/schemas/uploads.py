"""Pydantic DTOs for the /uploads endpoint.

Kept out of `reports.py` because uploads aren't a report — they were
originally grouped there for convenience and got separated once the
schemas folder grew.
"""
from typing import List

from pydantic import BaseModel


class UploadResult(BaseModel):
    # `rejected_samples` holds up to 5 "<card>: <reason>" strings so the UI
    # can surface a useful error without flooding the response on a bad file.
    filename: str
    source_format: str
    accepted: int
    rejected: int
    rejected_samples: List[str] = []
