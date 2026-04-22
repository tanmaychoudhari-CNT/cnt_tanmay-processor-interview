# Card Processor — Frontend

React SPA for the card-processor dashboard. Signs in against the FastAPI
backend, uploads transaction files, and renders charts + a filterable
transaction grid.

## Stack

- **React 18** + **Vite 5**
- **React Router v7** — client-side routing
- **Tailwind CSS 3** — styling (+ `tailwind-merge`, `clsx`)
- **Recharts** — charts on the dashboard
- **axios** — HTTP client (wraps the API envelope via `unwrap`)
- **Motion** (formerly framer-motion) — micro-animations
- **lucide-react** — icon set
- **date-fns** + **react-day-picker** — date filters
- **papaparse** + **xml2js** — client-side CSV / XML parsing for preview
- **Vitest** + **React Testing Library** + **jsdom** — test suite (45 tests)

## Folder layout

```
client/
├── index.html
├── vite.config.js              # dev server + /api proxy + Vitest config
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx                # React entry + router mount
    ├── App.jsx                 # top-level <Routes>
    ├── pages/
    │   ├── Login.jsx           # /login (public-only)
    │   └── Dashboard.jsx       # /  (protected)
    ├── routes/
    │   └── guards.jsx          # <ProtectedRoute> + <PublicOnlyRoute>
    ├── api/
    │   ├── api.js              # axios instance + response unwrap
    │   ├── auth.js             # login, me, logout
    │   └── transactions.js     # list / create / update / delete / bulk / upload / reports
    ├── components/
    │   └── dashboard/          # table, filters, charts, upload dropzone
    ├── context/
    │   ├── AuthContext.jsx     # token + user state, persisted to localStorage
    │   └── ThemeContext.jsx    # light / dark theme toggle
    ├── hooks/                  # useToast, etc.
    ├── lib/                    # small pure helpers
    ├── styles/                 # global CSS + Tailwind layer
    ├── assets/
    └── test/
        └── setup.js            # jest-dom matchers + axios mocks
```

## Prerequisites

- **Node.js 18+** (tested on 20)
- The **backend running on `:8000`** (or a `VITE_API_BASE_URL` pointing
  somewhere it *is* running)

## Setup

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with the seeded admin
credentials (`admin` / `admin123` by default — whatever you set in the
server's `SEED_ADMIN_*` env vars).

The Vite dev server proxies every `/api/*` request to `http://localhost:8000`,
so no CORS config is needed in development. The proxy target is defined in
[`vite.config.js`](vite.config.js).

## Environment variables

None are required in development — the proxy handles the backend URL.

For production builds, create `client/.env` with:

```
VITE_API_BASE_URL=https://api.your-domain.com/api
```

This is read by `src/api/api.js` when building the axios base URL. Only
variables prefixed with `VITE_` are exposed to the browser bundle.

## Running tests

```bash
npm test                 # CI run — 45 tests, headless
npm run test:watch       # watch mode while editing
npm run test:coverage    # v8 coverage to coverage/index.html
npm run test:report      # full HTML report + coverage in one run
npm run test:ui          # interactive Vitest UI
```

After `npm run test:report`:

- `client/html/index.html` — per-file test tree, durations, assertions
- `client/coverage/index.html` — v8 line + branch coverage

Tests run against **jsdom** and mock axios via `vi.mock` — no network
traffic, no live backend required.

## Build + preview

```bash
npm run build            # writes production bundle to client/dist/
npm run preview          # serves dist/ locally for a smoke test
```

The preview server runs on port 4173 by default. For a real deploy,
serve `dist/` from any static host (nginx, S3+CloudFront, Vercel, etc.).

## Routing + auth

- `/login` — public-only. A signed-in user is redirected to `/`.
- `/` — protected. A signed-out user is redirected to `/login`.
- Anything else falls back to `/`.

Both guards live in [`src/routes/guards.jsx`](src/routes/guards.jsx).

Auth state lives in `AuthContext`:

- On boot, reads the cached bearer token from `localStorage`, then calls
  `GET /api/auth/me` to re-hydrate the user.
- `login()` writes the token to `localStorage` and sets axios default
  headers for all subsequent calls.
- `logout()` clears `localStorage` and redirects to `/login`.

The tokens are stateless JWTs issued by the backend — any in-flight
request with an expired token receives a 401, which the axios interceptor
maps to "log out + redirect."

## API integration

All HTTP calls live in `src/api/`. Every request goes through the shared
axios instance ([`api.js`](src/api/api.js)) which:

1. Prepends `VITE_API_BASE_URL` (or `/api` in dev via Vite proxy).
2. Attaches `Authorization: Bearer <jwt>` when a token is present.
3. Unwraps the backend's `StandardResponse<T>` envelope — callers get
   `response.data` directly instead of `response.data.data`.
4. Maps 401 responses to `AuthContext.logout()` so a stale session
   auto-redirects to the login page.

## Styling

- Tailwind is configured via [`tailwind.config.js`](tailwind.config.js).
  Content globs point at `index.html` and `src/**/*.{js,jsx}`.
- Dark-mode toggle is class-based (`dark` on `<html>`), driven by
  `ThemeContext`. The user's preference is persisted in `localStorage`.
- Global styles + Tailwind directives live in `src/styles/`.

## Troubleshooting

- **`Network Error` in the console right after loading the app** — the
  backend isn't running on `:8000`. Start `uvicorn` in `server/` first.
- **401 on every API call but login works** — check that the axios
  interceptor is attaching the token. Look for `Authorization: Bearer ...`
  in the browser's Network tab. If absent, `localStorage` may have been
  cleared between requests.
- **Blank page on `/` after sign-in** — open DevTools, check for a
  `GET /api/auth/me` failure. Common cause: `JWT_SECRET` mismatch between
  two server restarts (tokens issued before the restart are invalid).
- **Vite fails with `ENOENT: no such file or directory .env`** — the
  `.env` file is optional. Only create one to override `VITE_API_BASE_URL`
  for a production build.
