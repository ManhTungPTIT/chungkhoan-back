// BỐN NHÁNH của /auth/refresh. Nhánh 2 là lý do tồn tại của cả thiết kế: nếu đá
// phiên bằng cách XOÁ hàng thì thiết bị bị đá rơi vào nhánh chống trộm và kéo
// theo phiên vừa đăng nhập cùng chết — người dùng đăng nhập máy mới, vài phút
// sau cả hai máy cùng văng.
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../refreshTokenService.js", () => ({
  findSessionByToken: vi.fn(async () => null),
  findSessionByPrevToken: vi.fn(async () => null),
  rotateSessionToken: vi.fn(async () => {}),
  revokeSession: vi.fn(async () => {}),
  revokeSessionByToken: vi.fn(async () => {}),
  createSession: vi.fn(async () => {}),
  newSessionId: vi.fn(() => "sid-new"),
}));
vi.mock("../../models/adminModel.js", () => ({ Admin: { findOne: vi.fn() } }));

import {
  findSessionByPrevToken,
  findSessionByToken,
  revokeSession,
  rotateSessionToken,
} from "../refreshTokenService.js";
import { refreshAccessToken } from "../authService.js";
import { AUTH_ERROR } from "../../untils/authErrors.js";

const REFRESH_SECRET = "test-refresh-secret";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
});

function token(overrides = {}) {
  return jwt.sign(
    { id: "u1", role: "user", sid: "sid-1", platform: "app", type: "refresh", jti: "j1", ...overrides },
    REFRESH_SECRET,
    { expiresIn: "7d" },
  );
}

describe("nhánh 1 — phiên bình thường", () => {
  it("xoay vòng tại chỗ và trả cặp token mới", async () => {
    const t = token();
    findSessionByToken.mockResolvedValue({
      _id: "row1", sid: "sid-1", platform: "app", tokenHash: "h1", revokedAt: null,
    });

    const result = await refreshAccessToken(t);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(rotateSessionToken).toHaveBeenCalledTimes(1);
    // sid phải sống sót qua xoay vòng, nếu không mỗi lần refresh là một phiên mới
    // và cơ chế đá phiên mất mục tiêu.
    expect(jwt.decode(result.refreshToken).sid).toBe("sid-1");
  });
});

describe("nhánh 2 — thiết bị vừa bị đá", () => {
  it("trả SESSION_SUPERSEDED và KHÔNG thu hồi thêm phiên nào", async () => {
    findSessionByToken.mockResolvedValue({
      _id: "row1", sid: "sid-1", platform: "app",
      revokedAt: new Date(), revokedReason: "superseded",
    });

    await expect(refreshAccessToken(token())).rejects.toMatchObject({
      code: AUTH_ERROR.SESSION_SUPERSEDED,
    });
    expect(revokeSession).not.toHaveBeenCalled();
    expect(rotateSessionToken).not.toHaveBeenCalled();
  });

  it("tự đăng xuất thì báo lỗi token thường, KHÔNG đổ tại thiết bị khác", async () => {
    findSessionByToken.mockResolvedValue({
      _id: "row1", sid: "sid-1", revokedAt: new Date(), revokedReason: "logout",
    });

    await expect(refreshAccessToken(token())).rejects.toMatchObject({
      code: AUTH_ERROR.INVALID_TOKEN,
    });
  });
});

describe("nhánh 3 — hai tab đua nhau", () => {
  it("cấp access token mới, KHÔNG xoay vòng, KHÔNG trả refresh token", async () => {
    findSessionByToken.mockResolvedValue(null);
    findSessionByPrevToken.mockResolvedValue({
      _id: "row1", sid: "sid-1", platform: "app", revokedAt: null,
    });

    const result = await refreshAccessToken(token());

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeUndefined();
    expect(rotateSessionToken).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
  });
});

describe("nhánh 4 — dùng lại token cũ thật", () => {
  it("thu hồi ĐÚNG phiên sid đó, không phải cả tài khoản", async () => {
    findSessionByToken.mockResolvedValue(null);
    findSessionByPrevToken.mockResolvedValue(null);

    await expect(refreshAccessToken(token())).rejects.toMatchObject({
      code: AUTH_ERROR.INVALID_TOKEN,
    });
    expect(revokeSession).toHaveBeenCalledWith({ sid: "sid-1", reason: "reuse" });
  });

  it("token cũ không có sid (tạo trước thay đổi này) thì không thu hồi bừa", async () => {
    findSessionByToken.mockResolvedValue(null);
    findSessionByPrevToken.mockResolvedValue(null);

    await expect(refreshAccessToken(token({ sid: undefined }))).rejects.toMatchObject({
      code: AUTH_ERROR.INVALID_TOKEN,
    });
    expect(revokeSession).not.toHaveBeenCalled();
  });
});

describe("hàng phiên cũ (tạo trước thay đổi này)", () => {
  // Mongo không backfill: hàng cũ KHÔNG có field platform. `default: "web"` của
  // schema chỉ áp cho document mới, nên đọc thẳng session.platform ra undefined
  // và token mới sẽ mang platform rỗng — lần login sau không đá được nó nữa.
  it("thiếu platform thì token mới vẫn mang web", async () => {
    findSessionByToken.mockResolvedValue({
      _id: "row1", sid: "sid-1", tokenHash: "h1", revokedAt: null,
    });

    const { refreshToken } = await refreshAccessToken(token());

    expect(jwt.decode(refreshToken).platform).toBe("web");
  });
});

describe("token hỏng", () => {
  it("chữ ký sai → INVALID_TOKEN, không tra DB", async () => {
    await expect(
      refreshAccessToken(jwt.sign({ id: "u1", type: "refresh" }, "secret-khac")),
    ).rejects.toMatchObject({ code: AUTH_ERROR.INVALID_TOKEN });
    expect(findSessionByToken).not.toHaveBeenCalled();
  });

  it("access token dùng nhầm chỗ refresh → INVALID_TOKEN", async () => {
    await expect(
      refreshAccessToken(token({ type: "access" })),
    ).rejects.toMatchObject({ code: AUTH_ERROR.INVALID_TOKEN });
  });
});
