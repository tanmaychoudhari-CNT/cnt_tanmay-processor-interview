import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the API layer the context depends on.
vi.mock("../../src/api/api", () => {
  const store = { token: null };
  return {
    getToken: () => store.token,
    setToken: (t) => {
      store.token = t;
    },
    __store: store,
    errorMessage: (e) => e?.message ?? "err",
  };
});

vi.mock("../../src/api/auth", () => ({
  login: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}));

import * as authService from "../../src/api/auth";
import * as apiModule from "../../src/api/api";
import { AuthProvider, useAuth } from "../../src/context/AuthContext";

function Probe() {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.username : "none"}</span>
      <button onClick={() => signIn("admin", "pw")}>sign in</button>
      <button onClick={() => signOut()}>sign out</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset the mocked token store so the auto-hydrate effect in each test
    // starts from a clean "no token" slate.
    apiModule.setToken(null);
  });

  it("starts with no user when there is no token", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("signIn stores token and sets the user", async () => {
    authService.login.mockResolvedValueOnce({ access_token: "T", expires_in: 60 });
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByText("sign in"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("admin");
    });
    expect(authService.login).toHaveBeenCalledWith("admin", "pw");
  });

  it("signOut clears the user", async () => {
    authService.login.mockResolvedValueOnce({ access_token: "T", expires_in: 60 });
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await act(async () => {
      await userEvent.click(screen.getByText("sign in"));
    });
    await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("admin"));

    await act(async () => {
      await userEvent.click(screen.getByText("sign out"));
    });
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("auto-hydrates user from stored token on mount", async () => {
    const api = await import("../../src/api/api");
    api.setToken("T");
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("admin");
    });
    expect(authService.me).toHaveBeenCalled();
  });

  // --- isJwtExpired branches -----------------------------------------------
  // We can't import the helper directly (it's not exported), so we exercise it
  // by setting tokens with various shapes and asserting the resulting boot
  // behaviour: an "expired" verdict drops the token without calling /me.

  function makeJwt(payload) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    return `${header}.${body}.signature`;
  }

  it("drops an expired token on mount and never calls /me", async () => {
    apiModule.setToken(makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(authService.me).not.toHaveBeenCalled();
    expect(apiModule.getToken()).toBeNull();
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("hydrates with a token that has no exp claim (server is authoritative)", async () => {
    apiModule.setToken(makeJwt({ sub: "admin" }));
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("admin")
    );
    expect(authService.me).toHaveBeenCalled();
  });

  it("hydrates with a non-JWT token (bypasses local check, falls to server)", async () => {
    apiModule.setToken("opaque-token-no-dots");
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("admin")
    );
  });

  it("treats a JWT with an unparseable payload as 'not local-expired' (lets server decide)", async () => {
    // Three dot-separated parts but the middle isn't valid base64 JSON.
    apiModule.setToken("aaa.notbase64json.bbb");
    authService.me.mockResolvedValueOnce({ id: 1, username: "admin" });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("admin")
    );
  });

  it("clears the token when /me fails after auto-hydrate", async () => {
    apiModule.setToken(makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    authService.me.mockRejectedValueOnce(new Error("server gone"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(apiModule.getToken()).toBeNull();
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("rolls back the token if signIn's /me follow-up rejects", async () => {
    authService.login.mockResolvedValueOnce({ access_token: "TOK", expires_in: 60 });
    authService.me.mockRejectedValueOnce(new Error("hydrate failed"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    // Wait for the no-token boot to settle so the click below isn't racing the
    // initial effect.
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );

    await act(async () => {
      try {
        await userEvent.click(screen.getByText("sign in"));
      } catch {
        /* signIn throws — that's expected, we're asserting the side-effect */
      }
    });
    await waitFor(() => expect(apiModule.getToken()).toBeNull());
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("treats a non-string stored token as 'expired' and drops it on mount", async () => {
    // Defensive branch: if some other code accidentally writes a number into
    // the token slot, we shouldn't trust it — isJwtExpired returns true early.
    apiModule.setToken(12345);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(authService.me).not.toHaveBeenCalled();
    expect(apiModule.getToken()).toBeNull();
  });

  it("throws a clear error when useAuth runs outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useAuth must be used/);
    spy.mockRestore();
  });
});
