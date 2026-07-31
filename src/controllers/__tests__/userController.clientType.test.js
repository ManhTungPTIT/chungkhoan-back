// Đăng nhập NGƯỜI DÙNG (/api/user/login) — đây là endpoint app thật sự dùng,
// khác /api/auth/login của admin. Cùng một vấn đề cookie cross-origin, nên cùng
// một cách xử lý: client gửi `X-Client: app` thì nhận refresh token trong body.
//
// Xem giải thích đầy đủ ở authController.clientType.test.js.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/userService.js", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserStats: vi.fn(),
  listPendingUsers: vi.fn(),
  approveUser: vi.fn(),
  rejectUser: vi.fn(),
  listUsers: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
  deleteUser: vi.fn(),
  setUserPackage: vi.fn(),
  changePassword: vi.fn(),
  requestPackage: vi.fn(),
  listPendingPackageRequests: vi.fn(),
  approvePackageRequest: vi.fn(),
  rejectPackageRequest: vi.fn(),
}));

import { loginUser } from "../../services/userService.js";
import { login } from "../userController.js";
import { REFRESH_COOKIE_NAME } from "../../untils/cookieUtils.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    cookiesSet: [],
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
  };
}

function fakeReq({ app = false, body = {} } = {}) {
  const headers = app ? { "x-client": "app" } : {};
  return {
    headers,
    body,
    cookies: {},
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
}

const CREDS = { account: "0900000000", password: "secret" };
const USER = { id: "u1", fullName: "Nguyen Van A" };

beforeEach(() => {
  vi.clearAllMocks();
  loginUser.mockResolvedValue({
    accessToken: "at1",
    refreshToken: "rt1",
    user: USER,
  });
});

describe("đăng nhập người dùng", () => {
  it("client app: refresh token về trong body, KHÔNG set cookie", async () => {
    const res = fakeRes();

    await login(fakeReq({ app: true, body: CREDS }), res);

    expect(res.body).toEqual({
      accessToken: "at1",
      refreshToken: "rt1",
      user: USER,
    });
    expect(res.cookiesSet).toEqual([]);
  });

  it("web: giữ nguyên luồng cookie, body KHÔNG lộ refresh token", async () => {
    const res = fakeRes();

    await login(fakeReq({ body: CREDS }), res);

    expect(res.body).toEqual({ accessToken: "at1", user: USER });
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.cookiesSet[0].name).toBe(REFRESH_COOKIE_NAME);
    expect(res.cookiesSet[0].value).toBe("rt1");
  });

  it("thiếu mật khẩu → 400 cho cả hai loại client", async () => {
    const res = fakeRes();

    await login(fakeReq({ app: true, body: { account: "0900000000" } }), res);

    expect(res.statusCode).toBe(400);
    expect(loginUser).not.toHaveBeenCalled();
  });
});
