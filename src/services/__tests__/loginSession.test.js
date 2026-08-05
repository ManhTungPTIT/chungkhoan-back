// Trần phiên: mỗi USER tối đa 1 ghế web + 1 ghế app. Admin KHÔNG bị giới hạn —
// tự khoá tay vận hành lúc đang xử sự cố là rủi ro lớn hơn lợi ích chống share.
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../../models/userModel.js", () => ({
  User: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn() },
}));
vi.mock("../../models/adminModel.js", () => ({
  Admin: { findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock("../../untils/tokenUtils.js", () => ({
  signTokens: vi.fn(() => ({ accessToken: "at", refreshToken: "rt" })),
}));
vi.mock("../refreshTokenService.js", () => ({
  createSession: vi.fn(async () => {}),
  revokeLivePlatformSessions: vi.fn(async () => {}),
  newSessionId: vi.fn(() => "sid-fixed"),
}));

import { User } from "../../models/userModel.js";
import { Admin } from "../../models/adminModel.js";
import { signTokens } from "../../untils/tokenUtils.js";
import {
  createSession,
  revokeLivePlatformSessions,
} from "../refreshTokenService.js";
import { loginUser } from "../userService.js";
import { loginAdmin } from "../authService.js";

const PASSWORD = "secret";

async function fakeUser(overrides = {}) {
  return {
    _id: "u1",
    fullName: "Nguyen Van A",
    email: "a@example.com",
    role: "user",
    status: "active",
    expiresAt: null,
    packageRequest: null,
    password: await bcrypt.hash(PASSWORD, 4),
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginUser — đá phiên cùng nền tảng", () => {
  it("login app đá phiên app cũ, KHÔNG đụng web", async () => {
    User.findOne.mockResolvedValue(await fakeUser());

    await loginUser({ account: "a@example.com", password: PASSWORD, platform: "app" });

    expect(revokeLivePlatformSessions).toHaveBeenCalledWith({
      subjectId: "u1",
      platform: "app",
    });
    expect(revokeLivePlatformSessions).toHaveBeenCalledTimes(1);
  });

  it("thiếu platform thì mặc định web — không bao giờ để trống", async () => {
    User.findOne.mockResolvedValue(await fakeUser());

    await loginUser({ account: "a@example.com", password: PASSWORD });

    expect(revokeLivePlatformSessions).toHaveBeenCalledWith({
      subjectId: "u1",
      platform: "web",
    });
  });

  it("đá phiên cũ TRƯỚC khi tạo phiên mới", async () => {
    User.findOne.mockResolvedValue(await fakeUser());
    const order = [];
    revokeLivePlatformSessions.mockImplementation(async () => order.push("revoke"));
    createSession.mockImplementation(async () => order.push("create"));

    await loginUser({ account: "a@example.com", password: PASSWORD, platform: "web" });

    expect(order).toEqual(["revoke", "create"]);
  });

  it("token và hàng phiên mang cùng sid + platform", async () => {
    User.findOne.mockResolvedValue(await fakeUser());

    await loginUser({ account: "a@example.com", password: PASSWORD, platform: "app" });

    expect(signTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", role: "user", sid: "sid-fixed", platform: "app" }),
    );
    expect(createSession).toHaveBeenCalledWith({
      subjectId: "u1",
      role: "user",
      platform: "app",
      sid: "sid-fixed",
      refreshToken: "rt",
    });
  });

  // Tám dòng bảng hành vi trong spec quy về đúng một luật: đá phiên đang sống
  // CÙNG nền tảng, không đụng nền tảng kia. Bảng dưới đi lại từng dòng để khi
  // ai đó sửa luật thì thấy ngay dòng nào của spec bị phá.
  it.each([
    ["Web A → login Web B", "web", "web"],
    ["App iPhone → login App Android", "app", "app"],
    ["App iPhone → cài lại App iPhone", "app", "app"],
    ["Web A → login App iPhone", "app", "app"],
    ["Web A + App iPhone → login Web B", "web", "web"],
    ["Web A + App iPhone → login App Android", "app", "app"],
    ["App iPhone → Chrome trên chính iPhone đó", "web", "web"],
    ["Web tab 1 → Web tab 2 cùng browser", "web", "web"],
  ])("%s: chỉ đá ghế %s", async (_label, platform, revokedPlatform) => {
    User.findOne.mockResolvedValue(await fakeUser());

    await loginUser({ account: "a@example.com", password: PASSWORD, platform });

    expect(revokeLivePlatformSessions).toHaveBeenCalledTimes(1);
    expect(revokeLivePlatformSessions).toHaveBeenCalledWith({
      subjectId: "u1",
      platform: revokedPlatform,
    });
  });

  it("sai mật khẩu thì KHÔNG đá phiên nào", async () => {
    User.findOne.mockResolvedValue(await fakeUser());

    await expect(
      loginUser({ account: "a@example.com", password: "sai" }),
    ).rejects.toThrow("Invalid credentials");
    expect(revokeLivePlatformSessions).not.toHaveBeenCalled();
  });
});

describe("loginAdmin — KHÔNG bị giới hạn phiên", () => {
  it("không đá phiên nào nhưng vẫn ghi platform/sid", async () => {
    Admin.findOne.mockResolvedValue({
      _id: "a1",
      username: "admin",
      role: "admin",
      password: await bcrypt.hash(PASSWORD, 4),
    });

    await loginAdmin("admin", PASSWORD, { platform: "web" });

    expect(revokeLivePlatformSessions).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith({
      subjectId: "a1",
      role: "admin",
      platform: "web",
      sid: "sid-fixed",
      refreshToken: "rt",
    });
  });
});
