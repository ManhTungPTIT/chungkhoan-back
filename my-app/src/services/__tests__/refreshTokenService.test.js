import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const create = vi.fn();
const findOne = vi.fn();
const deleteOne = vi.fn();
const deleteMany = vi.fn();

vi.mock("../../models/refreshTokenModel.js", () => ({
  RefreshToken: { create, findOne, deleteOne, deleteMany },
}));

beforeEach(() => {
  create.mockReset();
  findOne.mockReset();
  deleteOne.mockReset();
  deleteMany.mockReset();
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

const makeToken = () =>
  jwt.sign(
    { id: "u1", role: "user", type: "refresh", jti: "jti-1" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

describe("refreshTokenService", () => {
  it("saveRefreshToken stores the hash, jti, and expiry", async () => {
    const { saveRefreshToken } = await import("../refreshTokenService.js");
    const { hashToken } = await import("../../untils/tokenUtils.js");
    const token = makeToken();

    await saveRefreshToken({ subjectId: "u1", role: "user", refreshToken: token });

    expect(create).toHaveBeenCalledTimes(1);
    const doc = create.mock.calls[0][0];
    expect(doc.tokenHash).toBe(hashToken(token));
    expect(doc.jti).toBe("jti-1");
    expect(doc.subjectId).toBe("u1");
    expect(doc.role).toBe("user");
    expect(doc.expiresAt).toBeInstanceOf(Date);
  });

  it("findRefreshToken looks up by hash", async () => {
    const { findRefreshToken } = await import("../refreshTokenService.js");
    const { hashToken } = await import("../../untils/tokenUtils.js");
    findOne.mockResolvedValue({ subjectId: "u1" });
    const token = makeToken();

    const doc = await findRefreshToken(token);
    expect(findOne).toHaveBeenCalledWith({ tokenHash: hashToken(token) });
    expect(doc).toEqual({ subjectId: "u1" });
  });

  it("revokeAllForSubject deletes every token for the subject", async () => {
    const { revokeAllForSubject } = await import("../refreshTokenService.js");
    await revokeAllForSubject("u1");
    expect(deleteMany).toHaveBeenCalledWith({ subjectId: "u1" });
  });
});
