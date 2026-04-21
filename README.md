# Card Processor

A full-stack credit-card transaction processor with a secure dashboard.

- **Frontend:** React 18 + Vite + Tailwind CSS + Recharts
- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy 2 / Pydantic v2
- **Database:** PostgreSQL (managed via Alembic migrations)
- **Auth:** JWT (bcrypt-hashed passwords, stateless tokens)

## Features

- File ingest for **CSV / JSON / XML** batches with schema validation
- Manual bulk entry (up to 500 rows per submission)
- Full CRUD over transactions via authenticated REST API
- Server-side **search** by card number, **sort** by amount/timestamp, and **pagination**
- Reports: summary, by-card, by-card-type, by-day, rejected log
- Charts: bar (volume by card type), pie (count by card type), line (daily trend)
- Card-type classification from the leading digit
  - **3 → Amex · 4 → Visa · 5 → MasterCard · 6 → Discover**
  - Anything else (or non-digits, invalid length) is written to `rejected_transactions` with a reason

## Repository layout

```
.
├── client/                 # React (Vite) frontend
│   └── src/{components,pages,services,hooks,context,utils,styles}
├── server/                 # FastAPI backend
│   ├── app/
│   │   ├── config/         # Pydantic settings, env
│   │   ├── database/       # Engine + session factory
│   │   ├── models/         # SQLAlchemy ORM
│   │   ├── schemas/        # Pydantic I/O models
│   │   ├── services/       # Business logic (auth, parsing, CRUD, reports)
│   │   └── routes/         # FastAPI routers (auth, transactions, uploads, reports)
│   ├── alembic/            # Database migrations
│   └── main.py             # ASGI entrypoint
├── data/                   # Sample "real" dataset (CSV/JSON/XML)
└── test/                   # Small dataset for development
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 13+ running locally

## Running the test suites

**Backend** — 101 unit + integration tests (pytest + httpx, SQLite in-memory).

Everything below assumes the server virtualenv is active. If `pytest` or `pip`
reports "command not found", you haven't activated it — see the one-liners at
the bottom of this block.

```bash
cd server
pip install -r requirements-test.txt
pytest                      # run everything
pytest --cov=app            # with coverage
pytest tests/test_card_classifier.py -v   # a single file

# Detailed HTML report + HTML coverage (written to server/reports/):
pytest --html=reports/test-report.html --self-contained-html \
       --cov=app --cov-report=html:reports/coverage
# → open reports/test-report.html (per-test pass/fail, stdout, duration)
#   open reports/coverage/index.html (line-by-line source coverage)
```

**If your venv isn't activated**, invoke the venv's Python directly:

```powershell
# Windows PowerShell — activate the venv first:
.\.venv\Scripts\Activate.ps1
# (one-time fix if PowerShell blocks activation)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Windows cmd.exe:
.venv\Scripts\activate.bat

# Git Bash / macOS / Linux:
source .venv/Scripts/activate   # or .venv/bin/activate on macOS/Linux

# …or skip activation entirely:
.\.venv\Scripts\python -m pytest         # Windows
./.venv/bin/python -m pytest             # macOS/Linux
```

**Frontend** — 45 tests (Vitest + React Testing Library + jsdom):

```bash
cd client
npm test                   # CI run
npm run test:watch         # watch mode
npm run test:coverage      # v8 coverage (writes coverage/index.html)
npm run test:report        # full HTML report + coverage in one run
npm run test:ui            # interactive Vitest UI (live test explorer)
```

After `npm run test:report`:
- `client/html/index.html` — per-file test tree, durations, and assertions.
- `client/coverage/index.html` — v8 line/branch coverage.

Preview the static report locally with `npx vite preview --outDir html`, or
just open the file directly in a browser.

Tests never touch the live Postgres DB or hit the network — the backend uses
an in-memory SQLite engine, and the frontend mocks axios via `vi.mock`.

## 1. Database

Create the database:

```bash
psql -U postgres -c "CREATE DATABASE card_processor;"
```

## 2. Backend

```bash
cd server
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # edit DATABASE_URL if needed

# apply migrations
alembic upgrade head

# run
uvicorn main:app --reload --port 8000
```

The API boots at http://localhost:8000 and OpenAPI docs are live at
[http://localhost:8000/docs](http://localhost:8000/docs). On first startup a
default admin user (`admin` / `admin123`) is created automatically — change
credentials via `SEED_ADMIN_*` in `.env`.

> The app also calls `Base.metadata.create_all()` on startup as a convenience
> for local dev. Alembic remains the source of truth for schema changes.

## 3. Frontend

```bash
cd client
npm install
npm run dev
```

The UI starts at http://localhost:5173. Vite proxies `/api/*` to the backend,
so no CORS config is needed in dev. For production builds, set
`VITE_API_BASE_URL=https://api.example.com/api` in `client/.env`.

## 4. Try it

1. Visit http://localhost:5173, sign in as `admin` / `admin123`.
2. Go to **Upload**, drop one of the sample files from `test/` or `data/`.
3. Return to **Dashboard** to see the paginated, searchable table and summary panel.
4. Visit **Reports** for charts and the rejected-transaction audit.

## API overview

All routes (except `/api/auth/login` and `/api/health`) require
`Authorization: Bearer <token>`.

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------ |
| POST   | `/api/auth/login`                 | Exchange credentials for a JWT             |
| GET    | `/api/auth/me`                    | Current user profile                       |
| POST   | `/api/auth/logout`                | Client-side logout confirmation            |
| GET    | `/api/transactions`               | List (page, page_size, search, sort, type) |
| GET    | `/api/transactions/{id}`          | Retrieve one                               |
| POST   | `/api/transactions`               | Create one                                 |
| PUT    | `/api/transactions/{id}`          | Update one                                 |
| DELETE | `/api/transactions/{id}`          | Delete one                                 |
| POST   | `/api/transactions/bulk`          | Bulk manual entry                          |
| POST   | `/api/uploads`                    | Multipart CSV / JSON / XML upload          |
| GET    | `/api/reports/summary`            | Dashboard KPIs                             |
| GET    | `/api/reports/by-card`            | Totals grouped by card number              |
| GET    | `/api/reports/by-card-type`       | Totals grouped by card type                |
| GET    | `/api/reports/by-day`             | Daily totals                               |
| GET    | `/api/reports/rejected`           | Paged list of rejected records             |

All responses follow a consistent envelope:

```json
{ "success": true, "data": ..., "message": null }
```

## Design notes / tradeoffs

- **Card classification** uses only the leading digit, as specified in the
  original README. Luhn and strict Amex length checks were deliberately skipped
  because the provided sample data (16-digit PANs starting with `3`) does not
  satisfy them; basic length sanity `[12, 19]` is still enforced.
- **Money uses `Numeric(14, 2)` + Python `Decimal`** end-to-end; no floats touch
  the database or the API responses.
- **Rejection audit**: bad records land in `rejected_transactions` with the raw
  input and a human-readable reason — useful for later reconciliation.
- **Stateless JWT** auth means logout is client-side. For stricter revocation,
  plug in a Redis denylist keyed by token `jti`.
- **Frontend state**: plain React hooks + axios. Intentionally no React Query /
  Redux to keep the scope tight for this exercise.
- **Alembic vs `create_all`**: startup calls `create_all` so a brand-new dev
  machine works without running migrations first, but Alembic remains the
  authoritative schema tool for anything non-local.

## Extension points

The service layer is organized so these should each be small additions:

- New file formats (e.g. `.parquet`, `.xlsx`) → add a parser in
  `app/services/file_parser.py` and extend `SUPPORTED_EXTENSIONS`.
- New transaction types → add a discriminator column on `Transaction` and a
  factory in `transaction_service.create_transaction`.
- Role-based access → add a `role` column on `User`, a role-checking dependency
  next to `current_user`, and apply it to sensitive routers.

## Sample data

`test/` holds small fixtures (~100 rows each) for development.
`data/` holds the larger "real" dataset (~10k rows each).

Upload any of them through the UI or via `curl`:

```bash
curl -H "Authorization: Bearer $TOKEN" \
     -F "file=@data/data.csv" \
     http://localhost:8000/api/uploads
```
