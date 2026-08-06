// User tự xóa tài khoản mình (DELETE /api/user/me) — mock model, không cần MongoDB.
//
// Hai điều test này canh chừng: (1) mật khẩu sai thì KHÔNG được đụng gì tới bản ghi,
// (2) xóa xong phải thu hồi phiên trên MỌI nền tảng — `status = "deleted"` một mình
// không cắt được truy cập vì verifyToken không tra DB.
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../../models/userModel.js", () => ({
  User: { findOne: vi.fn(), findById: vi.fn(), find: vi.fn() },
}));
vi.mock("../../models/adminModel.js", () => ({
  Admin: { findById: vi.fn() },
}));
vi.mock("../../untils/tokenUtils.js", () => ({
  signTokens: vi.fn(() => ({ accessToken: "at", refreshToken: "rt" })),
}));
vi.mock("../refreshTokenService.js", () => ({
  createSession: vi.fn(async () => {}),
  revokeLivePlatformSessions: vi.fn(async () => {}),
  revokeAllSubjectSessions: vi.fn(async () => {}),
  newSessionId: vi.fn(() => "sid-fixed"),
}));

import { User } from "../../models/userModel.js";
import { revokeAllSubjectSessions } from "../refreshTokenService.js";
import { deleteOwnAccount } from "../userService.js";

function fakeUser(overrides = {}) {
  return {
    _id: "u1",
    fullName: "Nguyen Van A",
    email: "a@example.com",
    role: "user",
    status: "active",
    save: vi.fn(async function () {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteOwnAccount", () => {
  it("mật khẩu đúng → xóa mềm và thu hồi mọi phiên của tài khoản", async () => {
    const user = fakeUser({ password: await bcrypt.hash("secret", 4) });
    User.findById.mockResolvedValue(user);

    const result = await deleteOwnAccount("u1", "secret");

    expect(user.status).toBe("deleted");
    expect(user.save).toHaveBeenCalled();
    expect(revokeAllSubjectSessions).toHaveBeenCalledWith({ subjectId: "u1" });
    expect(result).toEqual({ id: "u1", status: "deleted" });
  });

  it("mật khẩu sai → ném lỗi, KHÔNG đổi status và KHÔNG thu hồi phiên", async () => {
    const user = fakeUser({ password: await bcrypt.hash("secret", 4) });
    User.findById.mockResolvedValue(user);

    await expect(deleteOwnAccount("u1", "sai-mat-khau")).rejects.toThrow(
      "Mật khẩu không chính xác",
    );
    expect(user.status).toBe("active");
    expect(user.save).not.toHaveBeenCalled();
    expect(revokeAllSubjectSessions).not.toHaveBeenCalled();
  });

  // Tài khoản admin nằm ở collection Admin, không phải User — nên tự nhiên rơi vào
  // nhánh này. Controller map thành 404.
  it("id không thuộc collection User (vd admin) → User not found", async () => {
    User.findById.mockResolvedValue(null);

    await expect(deleteOwnAccount("admin1", "secret")).rejects.toThrow(
      "User not found",
    );
    expect(revokeAllSubjectSessions).not.toHaveBeenCalled();
  });
});
