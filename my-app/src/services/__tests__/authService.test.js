import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const findRefreshToken = vi.fn();
const deleteRefreshToken = vi.fn();
const saveRefreshToken = vi.fn();
const revokeAllForSubject = vi.fn();

vi.mock("../refreshTokenService.js", () => ({
  findRefreshToken,
  deleteRefreshToken,
  saveRefreshToken,
  revokeAllForSubject,
}));

beforeEach(() => {
  findRefreshToken.mockReset();
  deleteRefreshToken.mockReset();
  saveRefreshToken.mockReset();
  revokeAllForSubject.mockReset();
  process.env.JWT_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

const refreshToken = () =>
  jwt.sign(
    { id: "u1", role: "user", type: "refresh", jti: "jti-1" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

describe("refreshAccessToken", () => {
  it("rotates: deletes the old token, saves a new one, returns a new pair", async () => {
    findRefreshToken.mockResolvedValue({ subjectId: "u1", role: "user" });
    const { refreshAccessToken } = await import("../authService.js");
    const old = refreshToken();

    const result = await refreshAccessToken(old);

    expect(deleteRefreshToken).toHaveBeenCalledWith(old);
    expect(saveRefreshToken).toHaveBeenCalledTimes(1);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe(old);
    const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET);
    expect(decoded.type).toBe("access");
    expect(decoded.id).toBe("u1");
  });

  it("detects reuse: valid JWT but absent in DB → revoke family + throw", async () => {
    findRefreshToken.mockResolvedValue(null);
    const { refreshAccessToken } = await import("../authService.js");
    const old = refreshToken();

    await expect(refreshAccessToken(old)).rejects.toThrow();
    expect(revokeAllForSubject).toHaveBeenCalledWith("u1");
    expect(saveRefreshToken).not.toHaveBeenCalled();
  });

  it("rejects a structurally invalid token", async () => {
    const { refreshAccessToken } = await import("../authService.js");
    await expect(refreshAccessToken("not-a-jwt")).rejects.toThrow();
  });
});

describe("logoutSession", () => {
  it("deletes the stored token", async () => {
    const { logoutSession } = await import("../authService.js");
    const tok = refreshToken();
    await logoutSession(tok);
    expect(deleteRefreshToken).toHaveBeenCalledWith(tok);
  });

  it("ignores a missing token", async () => {
    const { logoutSession } = await import("../authService.js");
    await expect(logoutSession(undefined)).resolves.toBeUndefined();
    expect(deleteRefreshToken).not.toHaveBeenCalled();
  });
});
