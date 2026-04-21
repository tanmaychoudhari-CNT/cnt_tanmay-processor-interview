import { beforeEach, describe, expect, it } from "vitest";

import { errorMessage, getToken, setToken, unwrap } from "./api";

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
