import { createContext, useContext, useEffect, useState } from "react";
import { getToken, setToken } from "../api/api";
import * as authService from "../api/auth";

const AuthContext = createContext(null);

/**
 * Decode the `exp` claim of a JWT without verifying the signature — we only
 * use it to decide whether to bother hitting the server at all. Real
 * validation is still done server-side on every request; this is a
 * purely-local optimization to drop an obviously-expired token early and
 * avoid a doomed /me round-trip.
 */
function isJwtExpired(token) {
  if (!token || typeof token !== "string") return true;
  const parts = token.split(".");
  // Anything we can't parse locally: fall through to the server. It will
  // reject with 401 and our axios interceptor clears the bad token. This
  // avoids false-positives on tokens using schemes we don't understand.
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (typeof payload.exp !== "number") return false;
    // 5-second safety margin for clock skew.
    return payload.exp * 1000 < Date.now() + 5_000;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Client-side expiry check — drops a stale token without hitting the
    // server and prevents the flash of "signed in" state for a doomed token.
    if (isJwtExpired(token)) {
      setToken(null);
      setLoading(false);
      return;
    }
    authService
      .me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(username, password) {
    // Persist the token ONLY after we've successfully fetched the user
    // profile. If /me fails, the token never hits localStorage, so we don't
    // leave a half-authenticated state behind for a later page load to
    // stumble into.
    const data = await authService.login(username, password);
    try {
      // Axios reads the token from localStorage on every request — so /me
      // needs it there temporarily. We roll back on failure.
      setToken(data.access_token);
      const profile = await authService.me();
      setUser(profile);
      return profile;
    } catch (err) {
      setToken(null);
      throw err;
    }
  }

  function signOut() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
