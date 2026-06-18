import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

describe("cookieUtils", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("defaults: httpOnly, lax, path /api/auth, not secure in dev", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.COOKIE_SAMESITE;
    const { refreshCookieOptions } = await import("../cookieUtils.js");
    const opts = refreshCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/api/auth");
    expect(typeof opts.maxAge).toBe("number");
  });

  it("production: secure true", async () => {
    process.env.NODE_ENV = "production";
    const { refreshCookieOptions } = await import("../cookieUtils.js");
    expect(refreshCookieOptions().secure).toBe(true);
  });

  it("setRefreshCookie writes the named cookie", async () => {
    const { setRefreshCookie, REFRESH_COOKIE_NAME } = await import("../cookieUtils.js");
    const res = { cookie: vi.fn() };
    setRefreshCookie(res, "tok123");
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      "tok123",
      expect.objectContaining({ httpOnly: true, path: "/api/auth" })
    );
  });
});

describe("setRefreshCookie maxAge derives from token exp", () => {
  it("uses the token's exp to set maxAge", () => {
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    const token = jwt.sign({ id: "u1", type: "refresh" }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "30d",
    });
    const calls = [];
    const res = { cookie: (name, value, opts) => calls.push({ name, value, opts }) };

    // dynamic import to pick up current module state
    return import("../cookieUtils.js").then(({ setRefreshCookie }) => {
      setRefreshCookie(res, token);
      const { opts } = calls[0];
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      // allow a few seconds of slack for execution time
      expect(opts.maxAge).toBeGreaterThan(expectedMs - 10000);
      expect(opts.maxAge).toBeLessThanOrEqual(expectedMs);
    });
  });

  it("falls back to default maxAge when token has no exp", () => {
    const calls = [];
    const res = { cookie: (name, value, opts) => calls.push({ name, value, opts }) };
    return import("../cookieUtils.js").then(({ setRefreshCookie }) => {
      setRefreshCookie(res, "not-a-jwt");
      expect(typeof calls[0].opts.maxAge).toBe("number");
      expect(calls[0].opts.maxAge).toBeGreaterThan(0);
    });
  });
});
