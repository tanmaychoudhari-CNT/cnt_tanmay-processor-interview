# Claude guidance — Server workspace

Guidance specific to the FastAPI / SQLAlchemy / Pydantic backend. For frontend rules (React, Vite, Tailwind, axios) see [client/CLAUDE.md](../client/CLAUDE.md).

---

## 1. Folder structure

```
server/
├── main.py                          FastAPI app: lifespan, middleware, /health, router mount
├── pytest.ini                       testpaths=tests, -q --tb=short --strict-markers
├── requirements.txt                 runtime deps (FastAPI, SQLAlchemy, slowapi, jose, bcrypt, …)
├── requirements-test.txt            pytest + pytest-cov
├── reports/                         coverage / test-report HTML output (gitignored)
└── app/
    ├── api/                         HTTP routers (one module per resource). NO SQL allowed here.
    │   ├── __init__.py              api_router = APIRouter(prefix="/api"); includes every sub-router
    │   ├── _deps.py                 current_user dep + shared `limiter` (slowapi)
    │   ├── auth.py                  /auth/login, /auth/me, /auth/logout
    │   ├── transactions.py          /transactions  (CRUD + /bulk + /restore)
    │   ├── reports.py               /reports/{summary, by-card, by-card-type, by-day}
    │   ├── uploads.py               /uploads  (multipart CSV/JSON/XML)
    │   └── exception_handlers.py    domain-exception → HTTP-400 mapping (registered in main.py)
    ├── config/
    │   └── settings.py              Pydantic BaseSettings; `settings` singleton; assert_production_ready()
    ├── database/                    SQLAlchemy session + per-resource query modules. ALL SQL lives here.
    │   ├── session.py               engine, SessionLocal, Base, get_db dep
    │   ├── indexes.py               CREATE INDEX IF NOT EXISTS for hot-path columns (Postgres only)
    │   ├── transaction_db.py        every SELECT/INSERT/UPDATE/DELETE on `transactions`
    │   └── user_db.py               every SELECT/INSERT/UPDATE/DELETE on `users`
    ├── models/                      ORM mappings (mirror the actual DDL exactly)
    │   ├── transaction.py           Transaction, CARD_TYPES, derive_card_type, TX_STATUSES, TX_SOURCES
    │   └── user.py                  User
    ├── schemas/                     Pydantic request / response models. NO ORM, NO SQL.
    │   ├── common.py                StandardResponse[T] envelope
    │   ├── auth.py                  LoginRequest, TokenResponse, UserOut
    │   ├── transaction.py           TransactionCreate / Update / Out / Filters / BulkResult
    │   ├── reports.py               SummaryResponse, ByCardItem, ByCardTypeItem, ByDayItem
    │   └── uploads.py               UploadResult
    ├── services/                    business logic. Validation + normalization. Calls into database/.
    │   ├── auth_service.py          hash/verify password, JWT mint/decode, ensure_seed_admin
    │   ├── transaction_service.py   create/update/list/bulk + summary/by_card/by_day/by_card_type
    │   ├── card_classifier.py       single source of truth: classify_card() + CardValidationError
    │   └── file_parser.py           parse_upload() for CSV/JSON/XML + Excel sci-notation recovery
    └── tests/                       pytest suite — see §5
```

**Layering rule**: `api/` calls `services/`, `services/` calls `database/`. No layer skips upward (`api/` never imports from `database/` directly) and no layer skips inward (`services/` never builds raw SQL). The only exception is the dependency chain `api/_deps.py` → `database/session.get_db` because that's a FastAPI `Depends()` plumbing concern, not application logic.

---

## 2. Conventions

- **Response envelope** — every success response is `StandardResponse[T]` from [schemas/common.py](app/schemas/common.py): `{success: true, data: T, message: str | null}`. The client's axios `unwrap()` strips it. **Errors do NOT use this shape** — they fall back to FastAPI's default `{detail: "..."}` body, mapped from domain exceptions via [exception_handlers.py](app/api/exception_handlers.py).
- **User scoping is mandatory** — every transaction-touching service call takes `user_id=user.id` from the `current_user` dep. A row belonging to user A is invisible to user B, including soft-deleted rows. The scoping happens once in the service layer; never re-implement it in the route.
- **`current_user` collapses 3 failure modes to one 401** — "no header", "bad token", and "user gone" all return the same generic `not authenticated` / `invalid or expired token` error so attackers can't enumerate users by error shape. Don't add per-cause detail.
- **Card validation has one entry point**: `classify_card()` in [services/card_classifier.py](app/services/card_classifier.py). Every write path (manual create, bulk, file upload) goes through it. It strips non-digits, checks length ∈ [12, 20], and rejects unknown leading digits. **No Luhn check** — card numbers are opaque identifiers in this schema.
- **`card_type` is derived, not stored** — the column was intentionally dropped. `derive_card_type()` (Python) and a `CASE substr(card_number, 1, 1)` (SQL, in [transaction_db.py](app/database/transaction_db.py)) both map leading digits 3/4/5/6 to Amex/Visa/MasterCard/Discover. Both must stay in sync — if you change the mapping, change both.
- **Soft delete only** — `is_deleted` column flips true; the row stays. Hard delete is **not exposed** via the API. Restore is a dedicated `POST /transactions/{id}/restore` route. The legacy-NULL handling in `_scope_filter` (rows from before the column existed) treats NULL as "active".
- **Domain exceptions, not inline 400s** — `CardValidationError`, `UnsupportedFileError`, `FileParseError` are caught globally in [exception_handlers.py](app/api/exception_handlers.py) and mapped to HTTP 400. Don't wrap service calls in `try/except HTTPException` in the route.
- **Sortable columns are allow-listed** — `SORTABLE_FIELDS` in [transaction_db.py](app/database/transaction_db.py) gates `?sort_by=`. Anything not in the dict falls back to `transaction_date`. Adding a new sortable column requires a one-line addition there.
- **Filters via `TransactionFilters` Depends model** — 15+ query params live in one Pydantic model with `extra="forbid"` so unknown / mistyped params return 422 instead of being silently ignored. The `status` field is internally `status_` (Python builtin clash) and gets renamed back in the route.
- **Naive UTC everywhere** — every datetime column is `DateTime(timezone=False)`. Helpers `_utcnow()` (in `models/transaction.py`) and `_resolve_timestamp()` (in `transaction_service.py`) produce `datetime.now(timezone.utc).replace(tzinfo=None)`. Do not introduce tz-aware datetimes — they break round-trip equality with the DB.
- **Money is `Decimal`** — `Numeric(12, 2)` in the column, `Decimal` everywhere in Python. Never coerce to `float` for math; only stringify for JSON output.
- **Rate limiting via slowapi** — global `120/minute` per IP, per-route stricter caps where it matters (login `10/minute`, bulk `30/hour`, upload `20/hour`). The `request: Request` argument is required by slowapi to read the client IP — keep it on every limited route.
- **Production-readiness gate** — `settings.assert_production_ready()` runs at startup and refuses to boot if `JWT_SECRET` is the dev default, if `JWT_SECRET` is < 32 chars, or if the seed-admin password is still `admin123`. Never bypass this in code; set real env vars instead.
- **Idempotent index DDL** — [indexes.py](app/database/indexes.py) runs `CREATE INDEX IF NOT EXISTS` on every boot (Postgres only — skipped on SQLite test engine). Add new hot-path indexes there.
- **Upload streaming + sniffing** — [api/uploads.py](app/api/uploads.py) reads in 1 MB chunks with a running byte counter so a multi-GB upload can't OOM us. Then `looks_like_declared_format` magic-byte sniffs the first 64 bytes before the parser runs — extension alone is trivially spoofable.
- **Excel scientific-notation recovery** — `_recover_scientific_card` in [services/file_parser.py](app/services/file_parser.py) detects values like `3.59E+15` and expands them to a 16-digit string so Excel-mangled CSVs aren't 100 %-rejected. Trailing precision is already lost upstream — that's a known-and-accepted artifact, not a bug to "fix".
- **Bcrypt 72-byte truncation** — `_encode()` in [services/auth_service.py](app/services/auth_service.py) silently truncates passwords to 72 bytes (bcrypt's hard limit) so callers don't have to think about it. Don't switch to a different KDF without auditing every call site.
- **Logging + request id** — every request gets an `X-Request-ID` (echoed back in the response header) and the unhandled-exception handler logs with `[rid=...]` so a 500 can be traced to its log line. Don't log card numbers or passwords.

---

## 3. Skills

### `backend-route-dev`
- **When**: adding a new endpoint or modifying an existing one in `app/api/`.
- **Checklist**:
  1. Pick the right router (`auth`, `transactions`, `reports`, `uploads`) or create a new one and include it in [api/__init__.py](app/api/__init__.py).
  2. Authenticated? → add `user: User = Depends(current_user)`.
  3. Inputs → bind to a Pydantic model in `app/schemas/`. Don't take loose `dict` payloads.
  4. Outputs → wrap in `StandardResponse[YourSchema]` and declare `response_model=...` on the decorator.
  5. Domain errors raised by the service layer → register a handler in `exception_handlers.py`. Don't try/except in the route.
  6. Rate-limit if the op is expensive or abuse-prone; remember the `request: Request` arg.
  7. Test against the in-memory client fixture; assert both 2xx happy path AND the relevant 4xx.

### `service-layer-dev`
- **When**: adding business logic, validation, or normalization in `app/services/`.
- **Checklist**:
  1. Validate / normalize inputs at the top of the function — fail fast with domain exceptions (`CardValidationError`, `ValueError`).
  2. Stamp server-controlled fields explicitly (`source`, `status="success"`, timestamps via `_resolve_timestamp`).
  3. Translate user-friendly filter values (e.g. `card_type="Visa"`) into DB predicates (`leading_digit="4"`) here, not in the DB layer.
  4. Delegate every SQL operation to a function in `app/database/`. No `db.execute(text(...))` in services.
  5. Pass `user_id` through every transaction-touching DB call. If you find yourself omitting it, you're crossing a security boundary.
  6. New domain exception type? → register a handler in [exception_handlers.py](app/api/exception_handlers.py) and document the mapped status code in the route docstring.

### `db-layer-dev`
- **When**: adding queries, indexes, or model fields in `app/database/` and `app/models/`.
- **Checklist**:
  1. Every transaction query uses `_scope_filter(user_id, include_deleted=False)` unless the caller explicitly opts in to the unscoped variant for an admin path (none today — adding one needs review).
  2. New sortable column? → add it to `SORTABLE_FIELDS` in [transaction_db.py](app/database/transaction_db.py); the route layer doesn't need to change.
  3. New hot-path filter? → add a `CREATE INDEX IF NOT EXISTS` line to [indexes.py](app/database/indexes.py).
  4. SQL must work on both PostgreSQL (prod) AND SQLite (tests). Stick to portable functions (`func.substr`, `func.lower`); avoid PG-specific dialect features unless guarded by `engine.dialect.name`.
  5. Model fields that mirror an externally-managed DDL: keep names, types, nullability, server defaults aligned with the SQL the DBA owns. Comment the model when a default exists in two places (Python `default=` + `server_default=text(...)`) to explain why.
  6. UUID columns use `sqlalchemy.Uuid` (cross-dialect) with `default=uuid.uuid4` (Python-side) — don't switch to a server-side `gen_random_uuid()` only.

### `upload-parser-dev`
- **When**: changing the file-ingest pipeline ([services/file_parser.py](app/services/file_parser.py) or [api/uploads.py](app/api/uploads.py)).
- **Checklist**:
  1. New format? → add the extension to `SUPPORTED_EXTENSIONS`, write an `_iter_<fmt>(content)` generator, and teach `looks_like_declared_format` how to magic-byte sniff it.
  2. Key normalization happens in `_normalize_keys` — extend it for new field aliases rather than branching in the row loop.
  3. Per-row failures append a sample to `samples` (capped at 5) and `continue`. Per-file failures (malformed JSON / XML root) raise `FileParseError`.
  4. Batch flush every `BATCH_SIZE` (= 500) rows so memory stays flat on large files. Don't change this without profiling.
  5. Don't add Luhn or brand-specific checks in the parser — the contract is "valid-shaped card number" (per `classify_card`), not "real card".
  6. `_recover_scientific_card` only kicks in when the input matches the strict `^[+-]?\d+(\.\d+)?[eE][+-]?\d+$` regex. Don't broaden it — we don't want to silently mangle plain decimal amounts.

### `auth-dev`
- **When**: touching `auth_service.py`, JWT minting/decoding, or password hashing.
- **Checklist**:
  1. `validate_password_strength` is the only gate before hashing — never produce a hash on an unvalidated string.
  2. JWTs are HS256 with `exp`. Decode failures and missing-user both raise the same generic error from `current_user` — keep that consistent.
  3. Bcrypt 72-byte cap is enforced by `_encode()`. Don't bypass it; passlib's quirks are why this is here.
  4. New seed-admin behaviour goes through `ensure_seed_admin` (called from the lifespan), not at module import.

---

## 4. API agent contract

- **Input**: a route spec (method + path + auth requirement + request body shape + expected response shape + rate limit if any).
- **Output**: a router function in `app/api/<resource>.py`, request/response Pydantic models in `app/schemas/<resource>.py`, business logic in `app/services/<resource>_service.py`, and any new SQL helpers in `app/database/<resource>_db.py`.
- **Definition of done**:
  - Route declares `response_model=StandardResponse[T]`.
  - Authenticated routes use `Depends(current_user)`; transaction-touching ones pass `user_id=user.id` to every service call.
  - Every domain exception the new code path can raise is mapped in `exception_handlers.py`.
  - Tests added/updated for happy path AND each documented error case (401/403/404/422).
  - `pytest -q` is green; no new warnings introduced beyond the ones already filtered in `pytest.ini`.
  - No raw SQL or ORM queries in the route or service file — both stay in `database/`.
  - If the new endpoint exposes anything PII/sensitive, double-check it's user-scoped.

---

## 5. Testing

- Runner: **pytest** + **FastAPI TestClient** + **in-memory SQLite** (StaticPool keeps the single connection alive across sessions). See [tests/conftest.py](tests/conftest.py).
- Fixtures (defined in `conftest.py`):
  - `db_engine` / `db_session` — a clean SQLite-in-memory engine per test.
  - `client` — `TestClient(app)` with `get_db` overridden and the module-level engine patched. Bypasses the lifespan; seeds the admin user manually.
  - `auth_token` / `auth_headers` — convenience for hitting protected routes (`POST /auth/login` under the hood, expects the seeded `admin / admin123`).
  - `_disable_rate_limiter` (autouse) — toggles slowapi off for every test so `auth_token` doesn't trip the `10/minute` login cap when many tests run in series.
- Test files are flat under `tests/` and named `test_<area>.py`. No subfolders for now — promote to `tests/<area>/` only if a single area exceeds ~500 lines.
- Mock external systems at the call boundary. Don't reach the real Postgres engine; the in-memory SQLite engine and `dependency_overrides` are how every test isolates the DB.
- When asserting on response bodies, deserialize with `r.json()` and check `success`, `data`, and `message` separately — the envelope shape is part of the contract.

```sh
pytest                                 # all tests, quiet output
pytest --cov=app                       # with coverage to terminal
pytest tests/test_card_classifier.py   # one file
pytest -k "bulk_create"                # tests matching name

# HTML reports (written to server/reports/):
pytest --cov=app --cov-report=html:reports/coverage --html=reports/test_report.html --self-contained-html
```

A typical run today is **~100 tests across 7 files** — each route module + each service module + each parser surface has at least one test. Adding a new route or service without an accompanying test is a regression in coverage discipline.
