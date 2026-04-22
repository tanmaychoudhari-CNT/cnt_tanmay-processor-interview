import { beforeEach, describe, expect, it } from "vitest";

import { api, errorMessage, getToken, setToken, unwrap } from "../../src/api/api";

describe("api.setToken / getToken", () => {
  beforeEach(() => localStorage.clear());

  it("persists the token into localStorage and reads it back", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
  });

  it("clears the stored token when called with a falsy value", () => {
    setToken("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe("api.unwrap", () => {
  it("prefers the nested `data.data` envelope when present", async () => {
    const p = Promise.resolve({ data: { data: { ok: true } } });
    await expect(unwrap(p)).resolves.toEqual({ ok: true });
  });

  it("falls back to `data` when there's no envelope", async () => {
    const p = Promise.resolve({ data: { raw: 1 } });
    await expect(unwrap(p)).resolves.toEqual({ raw: 1 });
  });
});

describe("api request/response interceptors", () => {
  // Swap in a fake axios adapter so we can drive the request/response pipeline
  // without ever opening a real socket. The interceptors run before/after
  // whatever the adapter resolves with.
  const originalAdapter = api.defaults.adapter;
  beforeEach(() => {
    localStorage.clear();
  });

  it("attaches Authorization: Bearer <token> when a token is present", async () => {
    setToken("XYZ");
    let captured;
    api.defaults.adapter = (config) => {
      captured = config;
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: {},
      });
    };
    try {
      await api.get("/health");
      expect(captured.headers.Authorization).toBe("Bearer XYZ");
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });

  it("omits the Authorization header when no token is set", async () => {
    setToken(null);
    let captured;
    api.defaults.adapter = (config) => {
      captured = config;
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: {},
      });
    };
    try {
      await api.get("/health");
      expect(captured.headers.Authorization).toBeUndefined();
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });

  it("clears the stored token when a 401 response comes back", async () => {
    setToken("XYZ");
    api.defaults.adapter = () =>
      Promise.reject({
        response: { status: 401, data: { detail: "expired" } },
        message: "Request failed with status code 401",
      });
    try {
      await expect(api.get("/me")).rejects.toBeDefined();
      expect(getToken()).toBeNull();
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });

  it("leaves the token alone for non-401 errors", async () => {
    setToken("XYZ");
    api.defaults.adapter = () =>
      Promise.reject({
        response: { status: 500, data: { detail: "boom" } },
        message: "Request failed with status code 500",
      });
    try {
      await expect(api.get("/anything")).rejects.toBeDefined();
      expect(getToken()).toBe("XYZ");
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });

  it("leaves the token alone for network errors with no response", async () => {
    setToken("XYZ");
    api.defaults.adapter = () =>
      Promise.reject({ message: "Network Error" });
    try {
      await expect(api.get("/anything")).rejects.toBeDefined();
      expect(getToken()).toBe("XYZ");
    } finally {
      api.defaults.adapter = originalAdapter;
    }
  });
});

describe("api.errorMessage", () => {
  it("prefers `response.data.detail`", () => {
    const err = { response: { data: { detail: "bad creds" } } };
    expect(errorMessage(err)).toBe("bad creds");
  });

  it("falls through to response.data.message", () => {
    const err = { response: { data: { message: "boom" } } };
    expect(errorMessage(err)).toBe("boom");
  });

  it("falls through to err.message", () => {
    expect(errorMessage({ message: "network" })).toBe("network");
  });

  it("returns a safe default when nothing matches", () => {
    expect(errorMessage({})).toBe("Something went wrong");
    expect(errorMessage(null)).toBe("Something went wrong");
  });
});
