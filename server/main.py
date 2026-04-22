import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.database.indexes import ensure_performance_indexes
from app.api import api_router
from app.api._deps import limiter
from app.api.exception_handlers import register_exception_handlers
from app.services import ensure_seed_admin


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("card-processor")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 0) Refuse to start in production with insecure defaults.
    settings.assert_production_ready()

    # 1) Auto-create the `users` table if it doesn't exist. The `transactions`
    #    table is managed outside this app — create_all() skips it if present.
    Base.metadata.create_all(bind=engine)

    # 2) Ensure the performance indexes exist on `transactions` (idempotent,
    #    no-op on SQLite test engine).
    ensure_performance_indexes(engine)

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

# Domain-exception → HTTP mapping (CardValidationError, UnsupportedFileError,
# FileParseError → 400). Routes no longer need per-call try/except blocks.
register_exception_handlers(app)


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
