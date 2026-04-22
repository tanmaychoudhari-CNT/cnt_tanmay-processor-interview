import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/api/api", () => {
  const api = {
    post: vi.fn(),
    get: vi.fn(),
  };
  return {
    api,
    unwrap: (p) => p.then((r) => r.data?.data ?? r.data),
  };
});

import { api } from "../../src/api/api";
import { login, logout, me } from "../../src/api/auth";

describe("auth service", () => {
  beforeEach(() => {
    api.post.mockReset();
    api.get.mockReset();
  });

  it("login POSTs credentials to /auth/login", async () => {
    api.post.mockResolvedValueOnce({
      data: { data: { access_token: "T", expires_in: 60 } },
    });
    const out = await login("admin", "pw");
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      username: "admin",
      password: "pw",
    });
    expect(out.access_token).toBe("T");
  });

  it("me GETs /auth/me", async () => {
    api.get.mockResolvedValueOnce({ data: { data: { id: 1 } } });
    await me();
    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });

  it("logout POSTs /auth/logout", async () => {
    api.post.mockResolvedValueOnce({ data: { data: null } });
    await logout();
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
  });
});
