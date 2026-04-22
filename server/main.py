import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.api import api_router
from app.api._deps import limiter
from app.services import ensure_seed_admin


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("card-processor")


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


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 0) Refuse to start in production with insecure defaults.
    settings.assert_production_ready()

    # 1) Auto-create the `users` table if it doesn't exist. The `transactions`
    #    table is managed outside this app — create_all() skips it if present.
    Base.metadata.create_all(bind=engine)

    # 2) Ensure the performance indexes exist on `transactions` (idempotent).
    #    Skip on SQLite (used only in tests).
    if engine.dialect.name != "sqlite":
        with engine.begin() as conn:
            for sql in PERFORMANCE_INDEXES:
                conn.execute(text(sql))

    # 3) Seed the default admin user.
    with SessionLocal() as db:
        ensure_seed_admin(db)

    logger.info("startup complete")
    yield


app = FastAPI(
    title="Card Processor API",
    version="1.0.0",
    description="Authenticated REST API for processing credit-card transactions.",
    lifespan=lifespan,
)

# Rate-limiter plumbing.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# Explicit methods + headers instead of wildcard — removes a foot-gun where a
# future origin wildcard would leak credential-bearing requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id to every call so logs + error responses correlate."""
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    logger.info(
        "%s %s -> %s [rid=%s]",
        request.method,
        request.url.path,
        response.status_code,
        rid,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exc(request: Request, exc: Exception):
    """Log the full traceback server-side, return an opaque id to the client."""
    rid = getattr(request.state, "request_id", "unknown")
    # Traceback stays in our logs only — the client never sees internals.
    logger.exception("unhandled [rid=%s]: %s", rid, exc)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "internal server error",
            "request_id": rid,
        },
    )


@app.get("/api/health", tags=["health"])
@limiter.limit("30/minute")
def health(request: Request):
    # Health endpoint is intentionally minimal — no DB round-trip, no details.
    return {"success": True, "data": {"status": "ok"}}


app.include_router(api_router)
