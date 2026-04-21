import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routes import api_router
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
    # 1) Auto-create the `users` table if it doesn't exist. The `transactions`
    #    table is managed outside this app — create_all() skips it if present.
    Base.metadata.create_all(bind=engine)

    # 2) Ensure the performance indexes exist on `transactions` (idempotent).
    #    Skip on SQLite (used only in tests) — these indexes are meant for
    #    production Postgres and CREATE INDEX on a transient test DB just
    #    slows things down.
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    response = await call_next(request)
    logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


@app.exception_handler(Exception)
async def unhandled_exc(_: Request, exc: Exception):
    logger.exception("unhandled: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "internal server error"},
    )


@app.get("/api/health", tags=["health"])
def health():
    return {"success": True, "data": {"status": "ok"}}


app.include_router(api_router)
