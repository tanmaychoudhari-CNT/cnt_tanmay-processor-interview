# Card Processor — Backend

Authenticated REST API for ingesting, classifying, and reporting on
credit-card transactions.

## Stack

- **Python 3.11+**
- **FastAPI** — HTTP + OpenAPI
- **SQLAlchemy 2** — ORM + connection pool
- **Pydantic v2 / pydantic-settings** — DTOs + typed settings
- **PostgreSQL** — primary datastore (SQLite in-memory for tests)
- **bcrypt + python-jose** — password hashing + JWTs
- **slowapi** — per-route rate limiting
- **pytest + httpx** — test suite (102 tests, all in-memory)

## Architecture

Strict three-layer separation — no layer-skipping:

```
┌────────────┐    ┌────────────┐    ┌─────────────┐
│    api/    │───▶│  services/ │───▶│  database/  │
│  (routes)  │    │  (logic)   │    │ (SQL only)  │
└────────────┘    └────────────┘    └─────────────┘
```

- `api/` — FastAPI routers, request validation, response envelope.
  Never builds SQL. Never catches domain errors (global handlers do that).
- `services/` — business rules, input normalization, orchestration.
  Never calls `db.add` / `db.commit` / `select(...)` — delegates every
  DB touch to the layer below.
- `database/` — every SELECT / INSERT / UPDATE / DELETE. One module per
  table (`user_db.py`, `transaction_db.py`). Holds the engine + session
  factory in `session.py`.

## Folder layout

```
server/
├── app/
│   ├── api/
│   │   ├── __init__.py             # aggregates all routers into api_router
│   │   ├── _deps.py                # current_user dep + shared slowapi limiter
│   │   ├── exception_handlers.py   # domain error → HTTP mapping
│   │   ├── auth.py                 # /auth/login, /auth/me, /auth/logout
│   │   ├── transactions.py         # /transactions CRUD + /bulk
│   │   ├── reports.py              # /reports/summary, by-card, by-card-type, by-day
│   │   └── uploads.py              # /uploads (multipart CSV/JSON/XML)
│   ├── config/
│   │   └── settings.py             # typed env-driven Settings singleton
│   ├── database/
│   │   ├── session.py              # engine, SessionLocal, get_db, Base
│   │   ├── user_db.py              # user-table queries
│   │   ├── transaction_db.py       # transaction CRUD + aggregations
│   │   └── indexes.py              # PERFORMANCE_INDEXES + ensure_performance_indexes
│   ├── models/                     # SQLAlchemy ORM (User, Transaction)
│   ├── schemas/                    # Pydantic DTOs (auth, transaction, reports, uploads, common)
│   └── services/                   # auth_service, transaction_service, file_parser, card_classifier
├── tests/                          # pytest — 102 tests (SQLite in-memory)
├── main.py                         # FastAPI app + lifespan + middleware
├── requirements.txt
├── requirements-test.txt
├── pytest.ini
└── .env.example                    # copy → .env and edit
```

## Prerequisites

- Python **3.11+**
- PostgreSQL **13+** (any version that supports `gen_random_uuid()` is fine)

SQLite is already used transparently by the test suite — you don't install
anything extra.

## Setup

```bash
cd server

# 1) Virtualenv
python -m venv .venv
.\.venv\Scripts\activate            # Windows PowerShell / CMD: .venv\Scripts\activate.bat
# source .venv/bin/activate         # macOS / Linux

# 2) Dependencies
pip install -r requirements.txt

# 3) Env config
cp .env.example .env                # then edit DATABASE_URL + JWT_SECRET

# 4) Database (one-time)
psql -U postgres -c "CREATE DATABASE card_processor;"
# The `users` table is auto-created by SQLAlchemy on first startup.
# The `transactions` table is assumed to exist — create it once via the
# project's SQL script or Postgres client.

# 5) Run
uvicorn main:app --reload --port 8000
```

API boots at **http://localhost:8000**. Interactive OpenAPI docs live at
**http://localhost:8000/docs**.

On first startup an admin user is seeded from `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD` (defaults `admin` / `admin123`). Change both before
running in anything non-local.

## Environment variables

All defined in [`app/config/settings.py`](app/config/settings.py). Mirror into
`.env` — any variable missing there falls back to the defaults shown below.

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `development` | Set to `production` to enable strict-boot assertions |
| `DATABASE_URL` | `postgresql+psycopg2://postgres:postgres@localhost:5432/card_processor` | SQLAlchemy connection URL |
| `JWT_SECRET` | dev placeholder | HS256 signing key — must be ≥ 32 chars in prod |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRES_MINUTES` | `60` | Access-token lifetime |
| `SEED_ADMIN_USERNAME` | `admin` | |
| `SEED_ADMIN_PASSWORD` | `admin123` | Rejected as prod default |
| `PASSWORD_MIN_LENGTH` | `8` | |
| `MAX_UPLOAD_BYTES` | `10_000_000` | Hard cap on multipart body size |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allow-list |

When `ENVIRONMENT=production`, the app refuses to boot if `JWT_SECRET` /
`SEED_ADMIN_PASSWORD` are still defaults — see `Settings.assert_production_ready()`.

## Running tests

```bash
pytest                                 # all 102 tests
pytest --cov=app                       # with coverage
pytest tests/test_card_classifier.py   # one file
pytest -k "bulk_create"                # tests matching name

# HTML reports (written to server/reports/):
pytest --html=reports/test-report.html --self-contained-html \
       --cov=app --cov-report=html:reports/coverage
```

Every test uses an **in-memory SQLite** engine plus a patched `get_db`
dependency — the live Postgres DB is never touched. The slowapi rate
limiter is auto-disabled inside tests via a fixture in `conftest.py`.

## API surface

All routes (except `/api/auth/login` and `/api/health`) require
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Username + password → JWT |
| GET  | `/api/auth/me` | Echo the authenticated user |
| POST | `/api/auth/logout` | Client-side logout confirmation |
| GET  | `/api/transactions` | Paginated + filtered list (see `TransactionFilters`) |
| GET  | `/api/transactions/{id}` | Fetch one |
| POST | `/api/transactions` | Create one (source = `manual_entry`) |
| PUT  | `/api/transactions/{id}` | Patch card / amount / date / status / remarks |
| DELETE | `/api/transactions/{id}` | Soft delete |
| POST | `/api/transactions/{id}/restore` | Undelete |
| POST | `/api/transactions/bulk` | Insert up to 500 rows (source = `manual_entry`) |
| POST | `/api/uploads` | Multipart CSV / JSON / XML (source = `file_upload`) |
| GET  | `/api/reports/summary` | KPIs: count, sum, avg, hi/lo, deleted |
| GET  | `/api/reports/by-card` | Top cards by volume |
| GET  | `/api/reports/by-card-type` | Brand-mix donut data |
| GET  | `/api/reports/by-day` | Daily trend |
| GET  | `/api/health` | Liveness probe (no DB hit) |

All success responses use the same envelope:

```json
{ "success": true, "data": { ... }, "message": null }
```

Errors fall back to FastAPI's default `{ "detail": "..." }` with an
appropriate status code.

## Card classification

Normalization + validation happens in `services/card_classifier.py`.
Leading digit → brand:

- `3` → Amex
- `4` → Visa
- `5` → MasterCard
- `6` → Discover

Anything else (or non-digit chars, or length outside 12–20) is rejected
with a `CardValidationError`, which the global handler maps to 400.

## Rate limiting

Shared slowapi instance in `api/_deps.py` — per-IP caps:

- Global: 120/min on every route
- `/auth/login`: 10/min (brute-force mitigation)
- `/uploads`: 20/hour
- `/transactions/bulk`: 30/hour

> **Prod gotcha:** slowapi stores counters in-process by default. With
> `uvicorn --workers N` or multi-replica deployments each worker has
> its own counters, so the effective limit becomes `N × configured`.
> Configure `Limiter(..., storage_uri="redis://...")` before horizontal
> scale-out.

## Design notes

- **Soft delete** — `is_deleted` flag instead of physical DELETE. Every
  user-scoped query adds `is_deleted = false OR is_deleted IS NULL` so
  legacy NULL rows still show up as active.
- **User scoping** — every query filters by `user_id = <current user>`
  at the database layer. One user's rows are invisible to another, even
  the soft-deleted ones.
- **Decimal-everywhere** — money uses `Numeric(12, 2)` + Python `Decimal`.
  No float touches the DB or API responses.
- **Stateless JWT** — logout is client-side. For strict revocation, add
  a Redis deny-list keyed by token `jti`.
- **Startup idempotence** — `Base.metadata.create_all()` + `CREATE INDEX
  IF NOT EXISTS` on every boot. Safe to restart; no migration step.

## Troubleshooting

- **`ModuleNotFoundError` on import** — your venv isn't active. Run
  `.\.venv\Scripts\Activate.ps1` (PowerShell) or `source .venv/bin/activate`.
- **`RuntimeError: Refusing to start in production...`** — `ENVIRONMENT=production`
  but `JWT_SECRET` / `SEED_ADMIN_PASSWORD` are still the dev defaults.
  Set real values in `.env`.
- **`401 invalid or expired token` right after login** — check that the
  clock on your machine is correct; JWT `exp` is compared against UTC.
- **Uploads stuck at 413** — raise `MAX_UPLOAD_BYTES` (multipart body
  size) in `.env`.
