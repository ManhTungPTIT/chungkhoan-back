import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";

beforeAll(() => {
  process.env.JWT_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

describe("tokenUtils", () => {
  it("hashToken is deterministic and differs per input", async () => {
    const { hashToken } = await import("../tokenUtils.js");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signTokens embeds jti + type in the refresh token", async () => {
    const { signTokens } = await import("../tokenUtils.js");
    const { accessToken, refreshToken } = signTokens({ id: "u1", role: "user" });

    const access = jwt.verify(accessToken, process.env.JWT_SECRET);
    const refresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    expect(access.type).toBe("access");
    expect(refresh.type).toBe("refresh");
    expect(typeof refresh.jti).toBe("string");
    expect(refresh.jti.length).toBeGreaterThan(0);
  });
});
