# Card Processor

A full-stack credit-card transaction processor with a secure dashboard.

- **Frontend:** React 18 + Vite + Tailwind + Recharts
- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy 2 / Pydantic v2
- **Database:** PostgreSQL (SQLite in-memory in tests)
- **Auth:** JWT, bcrypt-hashed passwords, stateless tokens

For deep-dive setup and per-module docs:

- [`server/README.md`](server/README.md) — architecture, env vars, API table, troubleshooting
- [`client/README.md`](client/README.md) — routing, axios wiring, build + preview

This file is the landing page — what the system does, how the pieces fit,
and the shortest path from "fresh clone" to "logged-in dashboard."

## Features

- **File ingest** — CSV / JSON / XML with magic-byte sniffing + row cap
- **Manual entry** — single-transaction form or bulk (≤ 500 rows / request)
- **Full CRUD** over transactions via authenticated REST API
- **Server-side** search, filtering, sorting, and pagination
- **Reports** — summary KPIs, top cards, brand mix, daily trend
- **Charts** — donut (brand mix), bar / area (daily volume), powered by Recharts
- **Card-type classification** from the leading digit:
  `3 → Amex · 4 → Visa · 5 → MasterCard · 6 → Discover`
  Anything else is rejected at the parser and never touches the DB.
- **Soft delete** with restore — deleted rows are hidden but recoverable
- **Per-user scoping** — every query filters by `user_id`; one user's rows
  are invisible to another
- **Per-IP rate limiting** — global 120/min, stricter on login / upload / bulk

## Architecture

```
┌─────────────┐   HTTP + JWT   ┌──────────────────────────────┐   SQL    ┌────────────┐
│  React SPA  │ ─────────────▶ │  FastAPI (api → services →   │ ───────▶ │ PostgreSQL │
│  (Vite)     │ ◀───────────── │  database), layered strictly │ ◀─────── │            │
└─────────────┘                └──────────────────────────────┘          └────────────┘
```

The backend enforces a **strict three-layer separation** — no layer-skipping:

- **`app/api/`** — FastAPI routers only. No SQL. No try/except for domain
  errors (global handlers map them to HTTP).
- **`app/services/`** — business rules, input normalization, orchestration.
  Never calls `db.add` / `select(...)`. Delegates every DB touch downward.
- **`app/database/`** — every SELECT / INSERT / UPDATE / DELETE. One module
  per table (`user_db.py`, `transaction_db.py`).

See [`server/README.md`](server/README.md#architecture) for the full rationale.

## Repository layout

```
.
├── client/              # React (Vite) frontend          → see client/README.md
├── server/              # FastAPI backend                → see server/README.md
├── data/                # Sample datasets (CSV / JSON / XML, ~10k rows each)
└── README.md            # you are here
```

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 13+** running locally

## Quick start

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE card_processor;"
```

The `users` table is auto-created by SQLAlchemy on first startup. The
`transactions` table is assumed to exist — create it once via your
team's SQL script or Postgres client before running the server.

### 2. Backend

```bash
cd server
python -m venv .venv
.\.venv\Scripts\activate          # Windows; source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env              # edit DATABASE_URL + JWT_SECRET
uvicorn main:app --reload --port 8000
```

API at **http://localhost:8000** · OpenAPI docs at **http://localhost:8000/docs**.

On first boot the admin user is seeded from `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD` (defaults `admin` / `admin123`). Override both for
anything non-local.

Full env-var reference + prod hardening checklist in
[`server/README.md`](server/README.md#environment-variables).

### 3. Frontend

```bash
cd client
npm install
npm run dev
```

UI at **http://localhost:5173**. Vite proxies `/api/*` to `:8000`, so no
CORS config is needed in dev.

### 4. Try it

1. Visit http://localhost:5173 and sign in as `admin` / `admin123`.
2. Go to **Upload** and drop one of the sample files from `data/`.
3. Return to **Dashboard** to see the paginated, filterable table and
   summary panel.
4. Scroll to **Reports** for the brand-mix donut and daily trend chart.

## Running the tests

Both suites run without touching your live database — backend uses
in-memory SQLite, frontend mocks axios.

```bash
# Backend — 102 tests (pytest + httpx + SQLite in-memory)
cd server && pytest

# Frontend — 45 tests (Vitest + React Testing Library + jsdom)
cd client && npm test
```

Full test commands (coverage, HTML reports, watch mode, Vitest UI) are in
each subfolder's README.

## API overview

All routes (except `/api/auth/login` and `/api/health`) require
`Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST   | `/api/auth/login` | Exchange credentials for a JWT |
| GET    | `/api/auth/me` | Current user profile |
| POST   | `/api/auth/logout` | Client-side logout confirmation |
| GET    | `/api/transactions` | Paginated + filtered list |
| GET    | `/api/transactions/{id}` | Retrieve one |
| POST   | `/api/transactions` | Create one (manual entry) |
| PUT    | `/api/transactions/{id}` | Update one |
| DELETE | `/api/transactions/{id}` | Soft delete |
| POST   | `/api/transactions/{id}/restore` | Undelete |
| POST   | `/api/transactions/bulk` | Bulk manual entry (≤ 500) |
| POST   | `/api/uploads` | Multipart CSV / JSON / XML upload |
| GET    | `/api/reports/summary` | Dashboard KPIs |
| GET    | `/api/reports/by-card` | Totals per distinct card |
| GET    | `/api/reports/by-card-type` | Totals per brand |
| GET    | `/api/reports/by-day` | Daily volume series |
| GET    | `/api/health` | Liveness probe |

Every success response uses the same envelope:

```json
{ "success": true, "data": { ... }, "message": null }
```

The client's axios `unwrap` helper strips the envelope so callers receive
`data` directly.

## Design notes / tradeoffs

- **Card classification** uses only the leading digit per spec. Luhn
  isn't enforced — the provided sample data (16-digit PANs starting with
  `3`) wouldn't satisfy it. Basic length sanity `[12, 20]` is still
  checked; mismatches fail the parser and never touch the DB.
- **Money is `Numeric(12, 2)` + Python `Decimal`** end-to-end. No float
  touches the database or an API response.
- **Soft delete** instead of physical `DELETE`. `is_deleted` is nullable
  so pre-column legacy rows keep showing as active (`false OR NULL`).
- **Per-user scoping** is enforced at the DB layer on every query, not
  the route layer. A new route can't accidentally leak another user's
  rows — the rule lives below the business logic.
- **Stateless JWT** — logout is client-side (drop the token). For strict
  revocation, add a Redis deny-list keyed by token `jti`.
- **Startup idempotence** — `Base.metadata.create_all()` + `CREATE INDEX
  IF NOT EXISTS` run on every boot. Safe to restart repeatedly; no
  separate migration step.
- **Frontend state** — plain React hooks + axios + context. No React
  Query / Redux, deliberately, to keep the scope tight.

## Sample data

`data/` ships three equivalent sample files (~10k rows each):

- `data.csv`
- `data.json`
- `data.xml`

Upload any of them through the UI or via `curl`:

```bash
curl -H "Authorization: Bearer $TOKEN" \
     -F "file=@data/data.csv" \
     http://localhost:8000/api/uploads
```

## Extension points

- **New file formats** (e.g. `.xlsx`, `.parquet`) — add a parser in
  `server/app/services/file_parser.py` and extend `SUPPORTED_EXTENSIONS`.
- **New user roles** — add a `role` column to `User`, a role-checking
  dependency next to `current_user` in `api/_deps.py`, and apply it to
  sensitive routers.
- **Harder rate limiting** — swap the in-process slowapi backend for
  Redis via `Limiter(..., storage_uri="redis://...")` before running
  multi-worker / multi-replica.
- **New aggregations** — add a query in `app/database/transaction_db.py`,
  a thin service wrapper in `app/services/transaction_service.py`, and a
  route in `app/api/reports.py`. Matches the existing pattern exactly.
