// Thin wrappers over /api/auth/* — unwrap strips the { success, data, ... }
// envelope so callers get the payload directly. Only AuthContext should
// call these; the rest of the app reads auth state via `useAuth()`.

import { api, unwrap } from "./api";

export const login = (username, password) =>
  unwrap(api.post("/auth/login", { username, password }));

// Used on app boot to re-hydrate user state from the token in localStorage.
export const me = () => unwrap(api.get("/auth/me"));

// Server-side no-op for stateless JWTs — we still call it so the token is
// verified as still-valid at the moment the user clicks sign-out.
export const logout = () => unwrap(api.post("/auth/logout"));
