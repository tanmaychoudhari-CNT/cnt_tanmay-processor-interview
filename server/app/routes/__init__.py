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
