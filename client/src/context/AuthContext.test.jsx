import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the API layer the context depends on.
vi.mock("../api/api", () => {
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

vi.mock("../api/auth", () => ({
  login: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}));

import * as authService from "../api/auth";
import * as apiModule from "../api/api";
import { AuthProvider, useAuth } from "./AuthContext";

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
    const api = await import("../api/api");
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
});
