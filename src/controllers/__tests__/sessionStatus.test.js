// Heartbeat phiên — endpoint DUY NHẤT của chart_back tra DB theo access token.
//
// Nó tồn tại vì server không đẩy được tin cho máy bị đá: chart_back là Express
// thuần, không có WS/SSE. Máy cũ chỉ biết mình chết khi CHÍNH NÓ hỏi, mà màn hình
// chính lấy dữ liệu từ BE Python nên chẳng bao giờ gọi chart_back.
// Xem specs 2026-08-05-session-instant-kick-design.md.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/refreshTokenService.js", () => ({
  findSessionBySid: vi.fn(async () => null),
}));

import { findSessionBySid } from "../../services/refreshTokenService.js";
import { sessionStatus } from "../authController.js";
import { AUTH_ERROR } from "../../untils/authErrors.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

/** verifyToken gắn payload access token vào req.admin (cả user lẫn admin). */
function fakeReq(admin) {
  return { admin };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sessionStatus", () => {
  it("phiên đang sống → 200 alive", async () => {
    findSessionBySid.mockResolvedValue({ sid: "sid-1", revokedAt: null });
    const res = fakeRes();

    await sessionStatus(fakeReq({ id: "u1", sid: "sid-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ alive: true });
  });

  it("phiên bị đá → 401 SESSION_SUPERSEDED", async () => {
    findSessionBySid.mockResolvedValue({
      sid: "sid-1",
      revokedAt: new Date(),
      revokedReason: "superseded",
    });
    const res = fakeRes();

    await sessionStatus(fakeReq({ id: "u1", sid: "sid-1" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(AUTH_ERROR.SESSION_SUPERSEDED);
  });

  it("tự đăng xuất → 401 nhưng KHÔNG đổ tại thiết bị khác", async () => {
    findSessionBySid.mockResolvedValue({
      sid: "sid-1",
      revokedAt: new Date(),
      revokedReason: "logout",
    });
    const res = fakeRes();

    await sessionStatus(fakeReq({ id: "u1", sid: "sid-1" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(AUTH_ERROR.INVALID_TOKEN);
  });

  it("không còn hàng phiên nào (TTL đã dọn) → 401 INVALID_TOKEN", async () => {
    findSessionBySid.mockResolvedValue(null);
    const res = fakeRes();

    await sessionStatus(fakeReq({ id: "u1", sid: "sid-1" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe(AUTH_ERROR.INVALID_TOKEN);
  });

  // Token cấp TRƯỚC khi có khái niệm phiên không mang sid. Coi chúng là chết thì
  // deploy phát là đăng xuất sạch người đang dùng, mà chúng tự hết trong 7 ngày.
  it("token cũ không có sid → coi như còn sống, KHÔNG tra DB", async () => {
    const res = fakeRes();

    await sessionStatus(fakeReq({ id: "u1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ alive: true });
    expect(findSessionBySid).not.toHaveBeenCalled();
  });
});
