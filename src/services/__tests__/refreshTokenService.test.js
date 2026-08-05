// Kho phiên là nơi DUY NHẤT chạm collection RefreshToken. Test mock model nên
// không cần MongoDB; thứ được khoá ở đây là HÌNH DẠNG TRUY VẤN — sai một filter
// (quên `revokedAt: null`, quên `prevUsableUntil`) là đá nhầm hoặc không đá được
// phiên nào, mà cả hai đều rất khó thấy khi chạy tay.
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../../models/refreshTokenModel.js", () => ({
  RefreshToken: {
    create: vi.fn(async (doc) => doc),
    findOne: vi.fn(async () => null),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
  },
}));

import { RefreshToken } from "../../models/refreshTokenModel.js";
import { hashToken } from "../../untils/tokenUtils.js";
import {
  ROTATION_GRACE_MS,
  createSession,
  findSessionByPrevToken,
  findSessionByToken,
  newSessionId,
  revokeLivePlatformSessions,
  revokeSession,
  revokeSessionByToken,
  rotateSessionToken,
} from "../refreshTokenService.js";

const SECRET = "test-refresh-secret";

function makeToken(overrides = {}) {
  return jwt.sign({ id: "u1", type: "refresh", jti: "jti-1", ...overrides }, SECRET, {
    expiresIn: "7d",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  it("lưu hash + sid + platform, hạn lấy từ exp của token", async () => {
    const token = makeToken();
    const exp = jwt.decode(token).exp;

    await createSession({
      subjectId: "u1",
      role: "user",
      platform: "app",
      sid: "sid-1",
      refreshToken: token,
    });

    expect(RefreshToken.create).toHaveBeenCalledWith({
      subjectId: "u1",
      role: "user",
      platform: "app",
      sid: "sid-1",
      tokenHash: hashToken(token),
      jti: "jti-1",
      expiresAt: new Date(exp * 1000),
    });
  });

  it("không bao giờ ghi token thô xuống DB", async () => {
    const token = makeToken();
    await createSession({
      subjectId: "u1",
      role: "user",
      platform: "web",
      sid: "sid-1",
      refreshToken: token,
    });
    expect(JSON.stringify(RefreshToken.create.mock.calls[0][0])).not.toContain(token);
  });
});

describe("newSessionId", () => {
  it("mỗi lần một giá trị khác nhau", () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });
});

describe("tra phiên", () => {
  it("findSessionByToken tra theo hash, KHÔNG lọc revokedAt", async () => {
    const token = makeToken();
    await findSessionByToken(token);
    expect(RefreshToken.findOne).toHaveBeenCalledWith({ tokenHash: hashToken(token) });
  });

  it("findSessionByPrevToken chỉ nhận phiên còn sống và còn trong cửa sổ ân hạn", async () => {
    const token = makeToken();
    await findSessionByPrevToken(token);

    const filter = RefreshToken.findOne.mock.calls[0][0];
    expect(filter.prevTokenHash).toBe(hashToken(token));
    expect(filter.revokedAt).toBeNull();
    expect(filter.prevUsableUntil.$gt).toBeInstanceOf(Date);
  });
});

describe("rotateSessionToken", () => {
  it("cập nhật TẠI CHỖ: đẩy hash cũ sang prev, mở cửa sổ ân hạn", async () => {
    const next = makeToken({ jti: "jti-2" });
    const before = Date.now();

    await rotateSessionToken(
      { _id: "row1", tokenHash: "hash-cu", sid: "sid-1", platform: "web" },
      next,
    );

    const [filter, update] = RefreshToken.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: "row1" });
    expect(update.$set.prevTokenHash).toBe("hash-cu");
    expect(update.$set.tokenHash).toBe(hashToken(next));
    expect(update.$set.jti).toBe("jti-2");
    expect(update.$set.prevUsableUntil.getTime()).toBeGreaterThanOrEqual(
      before + ROTATION_GRACE_MS,
    );
    // sid không nằm trong $set: phiên phải giữ nguyên danh tính qua xoay vòng.
    expect(update.$set.sid).toBeUndefined();
  });
});

describe("thu hồi", () => {
  it("revokeLivePlatformSessions chỉ đụng ĐÚNG nền tảng và chỉ phiên đang sống", async () => {
    await revokeLivePlatformSessions({ subjectId: "u1", platform: "app" });

    const [filter, update] = RefreshToken.updateMany.mock.calls[0];
    expect(filter).toEqual({ subjectId: "u1", platform: "app", revokedAt: null });
    expect(update.$set.revokedReason).toBe("superseded");
    expect(update.$set.revokedAt).toBeInstanceOf(Date);
  });

  it("revokeSession thu hồi theo sid, không theo tài khoản", async () => {
    await revokeSession({ sid: "sid-1", reason: "reuse" });

    const [filter, update] = RefreshToken.updateMany.mock.calls[0];
    expect(filter).toEqual({ sid: "sid-1", revokedAt: null });
    expect(update.$set.revokedReason).toBe("reuse");
  });

  it("revokeSessionByToken đánh dấu logout thay vì xoá hàng", async () => {
    const token = makeToken();
    await revokeSessionByToken(token, "logout");

    const [filter, update] = RefreshToken.updateOne.mock.calls[0];
    expect(filter).toEqual({ tokenHash: hashToken(token), revokedAt: null });
    expect(update.$set.revokedReason).toBe("logout");
  });
});
