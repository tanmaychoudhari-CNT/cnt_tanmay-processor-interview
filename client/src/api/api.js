// Shared axios instance + bearer-token helpers.
//
// Everything outside this module talks to the backend through `api` so the
// request interceptor can attach the current bearer token and the response
// interceptor can clear it on a 401 (which forces the route guard to
// bounce the user to /login).

import axios from "axios";

// Vite exposes VITE_ prefixed vars at build time. `/api` is the dev
// fallback — Vite dev-server proxies /api → the backend port.
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Not a perfect home for the token (localStorage is XSS-reachable) but good
// enough for an internal admin tool. See AuthContext for the boot-time
// validation flow that drops stale tokens early.
const TOKEN_KEY = "cp.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Attach bearer token on every outbound request. We read on every call
// (not once at module load) so a fresh login takes effect immediately.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // Drop the stale token. App re-renders to the Login screen on next tick.
      setToken(null);
    }
    return Promise.reject(err);
  }
);

// Backend returns `{ success, data, message }` — callers only want `data`.
// The fallback to `r.data` covers endpoints that skip the envelope (rare,
// but happens for fringe responses).
export function unwrap(promise) {
  return promise.then((r) => r.data?.data ?? r.data);
}

// Pull the most human-readable error string out of an axios error. Try in
// order: FastAPI's `detail`, our `message` envelope field, axios'
// network-layer message, then a generic fallback.
export function errorMessage(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong"
  );
}
