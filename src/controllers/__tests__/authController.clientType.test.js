// Client app (Capacitor) không nhận được cookie httpOnly: app chạy ở origin
// capacitor://localhost (iOS) hoặc https://localhost (Android) nên mọi request tới
// API là cross-origin, mà refresh cookie đang đặt sameSite=lax → không được gửi.
// Hệ quả nếu không sửa: đăng nhập xong vào được app, tới lần refresh đầu tiên là
// văng thẳng về màn đăng nhập.
//
// Giải pháp: client gửi header `X-Client: app` thì BE trả refresh token trong
// BODY thay vì set cookie, và đọc lại từ body ở refresh/logout.
//
// Ràng buộc quan trọng nhất của bộ test này: HÀNH VI WEB KHÔNG ĐƯỢC ĐỔI. Web
// đang chạy thật, mọi test "không có header" phải giữ nguyên luồng cookie cũ.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/authService.js", () => ({
  loginAdmin: vi.fn(),
  refreshAccessToken: vi.fn(),
  logoutSession: vi.fn(async () => {}),
}));

import {
  loginAdmin,
  refreshAccessToken,
  logoutSession,
} from "../../services/authService.js";
import { login, refresh, logout } from "../authController.js";
import { REFRESH_COOKIE_NAME } from "../../untils/cookieUtils.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    cookiesSet: [],
    cookiesCleared: [],
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, opts) {
      this.cookiesSet.push({ name, value, opts });
      return this;
    },
    clearCookie(name, opts) {
      this.cookiesCleared.push({ name, opts });
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function fakeReq({ app = false, body = {}, cookies = {} } = {}) {
  const headers = app ? { "x-client": "app" } : {};
  return {
    headers,
    body,
    cookies,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
}

const CREDS = { username: "admin", password: "secret" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("đăng nhập admin", () => {
  it("client app: refresh token về trong body, KHÔNG set cookie", async () => {
    loginAdmin.mockResolvedValue({
      accessToken: "at1",
      refreshToken: "rt1",
      admin: { id: "a1" },
    });
    const res = fakeRes();

    await login(fakeReq({ app: true, body: CREDS }), res);

    expect(res.body).toEqual({
      accessToken: "at1",
      refreshToken: "rt1",
      admin: { id: "a1" },
    });
    expect(res.cookiesSet).toEqual([]);
  });

  it("web: giữ nguyên luồng cookie, body KHÔNG lộ refresh token", async () => {
    loginAdmin.mockResolvedValue({
      accessToken: "at1",
      refreshToken: "rt1",
      admin: { id: "a1" },
    });
    const res = fakeRes();

    await login(fakeReq({ body: CREDS }), res);

    expect(res.body).toEqual({ accessToken: "at1", admin: { id: "a1" } });
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.cookiesSet[0].name).toBe(REFRESH_COOKIE_NAME);
    expect(res.cookiesSet[0].value).toBe("rt1");
  });
});

describe("refresh", () => {
  it("client app: đọc refresh token từ body, trả token ĐÃ XOAY VÒNG về body", async () => {
    // BE xoay vòng refresh token mỗi lần refresh và coi token cũ dùng lại là
    // đánh cắp (authService thu hồi phiên đó — xem revokeSession). App PHẢI nhận
    // được token mới, không trả về là lần refresh kế tiếp giết phiên người dùng.
    refreshAccessToken.mockResolvedValue({
      accessToken: "at2",
      refreshToken: "rt2",
    });
    const res = fakeRes();

    await refresh(fakeReq({ app: true, body: { refreshToken: "rt1" } }), res);

    expect(refreshAccessToken).toHaveBeenCalledWith("rt1");
    expect(res.body).toEqual({ accessToken: "at2", refreshToken: "rt2" });
    expect(res.cookiesSet).toEqual([]);
  });

  it("web: đọc từ cookie và set lại cookie mới, không đổi gì", async () => {
    refreshAccessToken.mockResolvedValue({
      accessToken: "at2",
      refreshToken: "rt2",
    });
    const res = fakeRes();

    await refresh(
      fakeReq({ cookies: { [REFRESH_COOKIE_NAME]: "rt1" } }),
      res,
    );

    expect(refreshAccessToken).toHaveBeenCalledWith("rt1");
    expect(res.body).toEqual({ accessToken: "at2" });
    expect(res.cookiesSet[0].value).toBe("rt2");
  });

  it("client app KHÔNG lấy nhầm cookie khi body trống", async () => {
    const res = fakeRes();

    await refresh(
      fakeReq({ app: true, cookies: { [REFRESH_COOKIE_NAME]: "rt-cu" } }),
      res,
    );

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("client app: refresh token hỏng → 401, không đụng cookie", async () => {
    refreshAccessToken.mockRejectedValue(new Error("Invalid or expired refresh token"));
    const res = fakeRes();

    await refresh(fakeReq({ app: true, body: { refreshToken: "hong" } }), res);

    expect(res.statusCode).toBe(401);
    expect(res.cookiesCleared).toEqual([]);
  });
});

describe("logout", () => {
  it("client app: thu hồi token lấy từ body, không xoá cookie", async () => {
    const res = fakeRes();

    await logout(fakeReq({ app: true, body: { refreshToken: "rt1" } }), res);

    expect(logoutSession).toHaveBeenCalledWith("rt1");
    expect(res.cookiesCleared).toEqual([]);
    expect(res.statusCode).toBe(204);
  });

  it("web: thu hồi token từ cookie rồi xoá cookie", async () => {
    const res = fakeRes();

    await logout(fakeReq({ cookies: { [REFRESH_COOKIE_NAME]: "rt1" } }), res);

    expect(logoutSession).toHaveBeenCalledWith("rt1");
    expect(res.cookiesCleared[0].name).toBe(REFRESH_COOKIE_NAME);
  });
});
