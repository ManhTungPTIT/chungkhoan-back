// Logout phải ĐÁNH DẤU chứ không xoá: hàng còn lại là thứ duy nhất cho nhánh 2
// của /auth/refresh biết đây là "tự đăng xuất" chứ không phải "bị đá" — hai
// chuyện hiện ra hai thông báo khác nhau cho người dùng.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../refreshTokenService.js", () => ({
  revokeSessionByToken: vi.fn(async () => {}),
  findSessionByToken: vi.fn(async () => null),
  findSessionByPrevToken: vi.fn(async () => null),
  rotateSessionToken: vi.fn(async () => {}),
  revokeSession: vi.fn(async () => {}),
  createSession: vi.fn(async () => {}),
  newSessionId: vi.fn(() => "sid-new"),
}));
vi.mock("../../models/adminModel.js", () => ({ Admin: { findOne: vi.fn() } }));

import { revokeSessionByToken } from "../refreshTokenService.js";
import { logoutSession } from "../authService.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logoutSession", () => {
  it("đánh dấu phiên là logout", async () => {
    await logoutSession("rt-1");
    expect(revokeSessionByToken).toHaveBeenCalledWith("rt-1", "logout");
  });

  it("không có token thì không đụng DB", async () => {
    await logoutSession(undefined);
    expect(revokeSessionByToken).not.toHaveBeenCalled();
  });
});
