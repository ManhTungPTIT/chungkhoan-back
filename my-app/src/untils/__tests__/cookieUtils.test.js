import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
