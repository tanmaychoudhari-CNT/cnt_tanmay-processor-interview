"""Top-level API router.

Every HTTP route in the app hangs off of `api_router`, which is mounted at
`/api` in `main.py`. Keeping the prefix centralized here means individual
route modules stay unaware of the global prefix and can be composed in any
order.
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .transactions import router as tx_router
from .reports import router as report_router
from .uploads import router as upload_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(tx_router)
api_router.include_router(report_router)
api_router.include_router(upload_router)

__all__ = ["api_router"]
