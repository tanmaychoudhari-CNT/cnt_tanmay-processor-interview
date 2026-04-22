# Claude guidance — Client workspace

Guidance specific to the React / Vite / Tailwind UI. For backend rules (FastAPI, SQLAlchemy, card validation) see [server/CLAUDE.md](../server/CLAUDE.md).

---

## 1. Folder structure

```
client/
├── index.html                       Vite entry
├── vite.config.js                   dev server + /api proxy + Vitest config
├── tailwind.config.js               dark: "class", accent + ink tokens
├── postcss.config.js
├── package.json                     type: "module", scripts: dev/test/build
└── src/
    ├── main.jsx                     React entry: BrowserRouter → ThemeProvider → AuthProvider → App
    ├── App.jsx                      <Routes> + <ToastProvider>, two routes (/login, /)
    ├── pages/
    │   ├── Login.jsx                /login  — wrapped in <PublicOnlyRoute>
    │   └── Dashboard.jsx            /       — wrapped in <ProtectedRoute>, orchestrates all panels
    ├── routes/
    │   └── guards.jsx               ProtectedRoute, PublicOnlyRoute (both gate on AuthContext.loading)
    ├── api/                         axios-wrapped API callers, one module per resource
    │   ├── api.js                   shared axios instance + token helpers + unwrap + errorMessage
    │   ├── auth.js                  login / me / logout
    │   └── transactions.js          list / create / update / delete / bulk / upload / reports
    ├── components/dashboard/        feature-specific composites (flat — no sub-folders)
    │   ├── Navbar, ThemeToggle
    │   ├── SummaryPanel, DetailedSummary, InsightsPanel
    │   ├── DataInput (upload dropzone), DataGrid (table + pagination)
    │   ├── FilterBar, DateRangePicker
    │   ├── ChartsPanel (Recharts)
    │   ├── EditTransactionModal
    │   └── CardBrandLogo
    ├── context/
    │   ├── AuthContext.jsx          user + loading + signIn / signOut, JWT exp pre-check
    │   └── ThemeContext.jsx         light / dark toggle, persisted to localStorage
    ├── hooks/
    │   ├── useToast.jsx             ToastProvider + useToast — fixed top-right container
    │   └── useDebounce.js           350 ms default, used by the grid's search box
    ├── lib/
    │   └── utils.js                 cn(), formatCurrency(), formatNumber(), maskCard(), maskCardNumber()
    ├── styles/index.css             Tailwind base/components/utilities + a few keyframe layers
    ├── assets/
    └── test/setup.js                jest-dom matchers, localStorage/cleanup between tests, matchMedia stub
```

**Rule**: every feature component lives under `components/dashboard/` — we intentionally don't have a `design-system/` layer yet. If a component is reused outside the dashboard (e.g. by the Login page), that's the signal to promote it to a new top-level `components/ui/` folder and update this doc.

---

## 2. Conventions

- **Client never filters locally** — pagination, sort, and all filters (`card_number`, `card_type`, `status`, `min_amount`, `max_amount`, `from`, `to`, etc.) are forwarded to `GET /api/transactions`. The only client-side derivation is in `deriveEntryStats` (Dashboard.jsx) which computes things the server doesn't expose (today count, unique cards, top brand) from the in-memory 10k window.
- **DTO mapping happens at the API boundary** — [api/transactions.js](src/api/transactions.js) has a `toEntry()` that converts server `snake_case` + ISO dates into the UI's `camelCase` + millisecond epochs. Every render path expects the UI shape; never pass a raw server row into a component.
- **Server data is fetched per-mount**, not cached in Context. `AuthContext` holds user state, `ThemeContext` holds the theme, `ToastContext` holds the toast queue — that's it. Dashboard-level data (entries, stats, reports) lives in `Dashboard.jsx`'s component state with a 15 s poll (`REFRESH_MS`) for reports.
- **Axios envelope unwrap** — call sites never see `response.data.data`. Always go through `unwrap(api.x(...))` from `api/api.js`, which also handles the rare endpoint that skips the envelope.
- **Token lifecycle** — `localStorage.cp.token` is the source of truth. The axios request interceptor reads it on every call (so a fresh login takes effect immediately), and the response interceptor clears it on 401 (so a stale session auto-redirects via the route guard).
- **JWT expiry pre-check** — `AuthContext.isJwtExpired()` decodes `exp` client-side with a 5-second clock-skew margin. It's an optimisation only — server-side validation is still authoritative.
- **Tailwind tokens + `cn()`** — compose class strings with [lib/utils.js](src/lib/utils.js)'s `cn()` (clsx + tailwind-merge) so `px-2 px-4` collapses cleanly. Dark-mode variants use the `dark:` prefix (class-based dark mode; `ThemeContext` toggles `<html class="dark">`).
- **Card display** — two canonical helpers: `maskCard(card, 4)` for tight contexts (chips, tooltips → `•••• 0355`) and `maskCardNumber(card)` for rows (`42**********0355`). Don't render raw PAN.
- **Toasts** — one fixed-position container lives inside `ToastProvider` (mounted in `App.jsx`). Call sites just use `useToast().success/error/info(msg)`. No inline variant right now — if a form ever needs embedded toasts, add a prop-driven mode rather than a second Provider.
- **No FOUC on theme** — an inline script in [main.jsx](src/main.jsx) applies the persisted theme class *before* React paints. Don't move that logic into a component.

---

## 3. Skills

### `frontend-dev`
- **When**: adding / modifying pages, dashboard panels, or hooks.
- **Checklist**:
  1. Does it fetch from the server? → add or reuse an `api/*` function; call it via `unwrap(...)` and map through `toEntry()` if the shape is a transaction row.
  2. Does it filter / sort / paginate? → send params to the server, don't filter arrays in the component.
  3. Does it need user state? → `useAuth()`. Theme? → `useTheme()`. Toasts? → `useToast()`. Anything else should be local component state.
  4. Use `cn()` from `lib/utils.js` for conditional Tailwind classes — don't concatenate strings with template literals.
  5. Use `formatCurrency` / `formatNumber` from `lib/utils.js`. Amounts are always USD; numbers always get thousand-separators.
  6. Mask card numbers with `maskCard` (compact) or `maskCardNumber` (full-row). Never render raw PAN.
  7. Mirror the source path under `tests/` — `src/components/dashboard/Foo.jsx` gets `tests/components/dashboard/Foo.test.jsx`.
  8. Dark-mode every new surface — always pair light classes with a `dark:` counterpart (`bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-50`).

### `upload-ingest-dev`
- **When**: changing the upload flow (dropzone, progress, accepted formats, client-side preview).
- **Checklist**:
  1. Supported formats live in [DataInput.jsx](src/components/dashboard/DataInput.jsx). CSV / JSON / XML is the server contract — don't invent new extensions on the client.
  2. Progress wiring: pass `onProgress` into `uploadFile(file, onProgress)`. Guard against missing `e.total` (some proxies strip it) — leave the bar at its last value rather than snapping to 0.
  3. The server auto-recovers Excel scientific-notation card numbers (`3.59E+15` → 16 digits). Don't re-parse CSV card columns on the client to "fix" this — the server owns that logic now.
  4. After a successful upload, trigger a full dashboard reload (`loadData()` in `Dashboard.jsx`), not just a reports refresh — the entries list needs to repopulate too.

### `chart-dev`
- **When**: adding or adjusting anything in `ChartsPanel` / `InsightsPanel` / `DetailedSummary`.
- **Checklist**:
  1. Distribution / per-row charts can read from `entries` (in-memory, capped at 10k).
  2. Aggregate charts (by-card, by-day, by-card-type) **must** read from the `/reports/*` endpoints via `getByCardType` / `getByDay` / `getByCard` — they reflect every row in the dataset, not just the capped window.
  3. Recharts components render into a `<ResponsiveContainer>` — size them with `min-h-*` on the parent, never hard-code `width` / `height`.
  4. Add the `Recharts` 0-dimension warning to the test setup if a new chart component logs noisy warnings in jsdom.

---

## 4. UI agent contract

- **Input**: a page / panel spec (route, data it shows, user actions it exposes).
- **Output**: a file in `pages/` (if it's a new route) or `components/dashboard/` (if it's a panel), plus the corresponding `api/*` functions if new endpoints are involved.
- **Definition of done**:
  - Dev server (`npm run dev`) renders the change without console errors or unhandled promise warnings.
  - Empty / loading / error states are all handled — don't ship a component that renders a blank surface on `[]`.
  - Light AND dark themes both look correct — walk through the change in both by clicking `ThemeToggle`.
  - Tests added / updated — at minimum a render smoke test for new components, and an `api/*.test.js` case for new endpoints (mock axios, not the global fetch).
  - All filters / sorts reach the server. No `items.filter(...)` in render.
  - `npm test` is green.

---

## 5. Testing

- Runner: **Vitest 2** + **React Testing Library 16** + **@testing-library/jest-dom** + **jsdom** (see [vite.config.js](vite.config.js) `test:` block).
- Test files live in a top-level `client/tests/` directory whose layout mirrors `client/src/` exactly — `src/pages/Login.jsx` is tested by `tests/pages/Login.test.jsx`. No colocated tests, no `__tests__/` folders.
- [tests/setup.js](tests/setup.js) runs before every test: registers jest-dom matchers, clears `localStorage`, cleans up rendered DOM, and stubs `window.matchMedia` (jsdom doesn't implement it).
- Imports inside a test file go through the mirrored `../../src/...` path (and `vi.mock(...)` strings use the same path so the mock resolves to the exact module the source imports).
- Mock axios at the module boundary with `vi.mock("axios")` or mock the `api/*` function directly with `vi.mock("../api/transactions")`. Don't hit a real network.
- When testing routed components, wrap in `<MemoryRouter>` from `react-router-dom`.
- When testing components that consume contexts, wrap in the matching provider (`<AuthProvider>`, `<ThemeProvider>`, `<ToastProvider>`) or the smallest stub that satisfies `useAuth()` / `useToast()`.

```sh
npm test                 # one-shot run (CI mode)
npm run test:watch       # re-run on change while editing
npm run test:coverage    # v8 coverage → coverage/index.html
npm run test:report      # HTML test + coverage report in one shot
npm run test:ui          # interactive Vitest UI
npx vitest src/api       # one folder
npx vitest -t "toEntry"  # tests matching name
```
