// DELETE /api/user/me — user tự xóa tài khoản mình.
//
// Danh tính LUÔN lấy từ access token (req.admin.id), không bao giờ từ body: gửi id
// trong body thì ai cũng xóa được người khác.
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
  deleteOwnAccount: vi.fn(),
  setUserPackage: vi.fn(),
  changePassword: vi.fn(),
  requestPackage: vi.fn(),
  listPendingPackageRequests: vi.fn(),
  approvePackageRequest: vi.fn(),
  rejectPackageRequest: vi.fn(),
}));

import { deleteOwnAccount } from "../../services/userService.js";
import { deleteMe } from "../userController.js";
import { REFRESH_COOKIE_NAME } from "../../untils/cookieUtils.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    cookiesCleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    clearCookie(name, opts) {
      this.cookiesCleared.push({ name, opts });
      return this;
    },
  };
}

const req = (body = {}, id = "u1") => ({ body, admin: { id } });

beforeEach(() => {
  vi.clearAllMocks();
  deleteOwnAccount.mockResolvedValue({ id: "u1", status: "deleted" });
});

describe("deleteMe", () => {
  it("mật khẩu đúng → 200, gọi service với id từ token và xóa cookie refresh", async () => {
    const res = fakeRes();

    await deleteMe(req({ password: "secret" }), res);

    expect(deleteOwnAccount).toHaveBeenCalledWith("u1", "secret");
    expect(res.statusCode).toBe(200);
    expect(res.cookiesCleared[0].name).toBe(REFRESH_COOKIE_NAME);
  });

  it("thiếu mật khẩu → 400, KHÔNG chạm tới service", async () => {
    const res = fakeRes();

    await deleteMe(req({}), res);

    expect(res.statusCode).toBe(400);
    expect(deleteOwnAccount).not.toHaveBeenCalled();
  });

  it("mật khẩu sai → 400 kèm thông điệp của service, KHÔNG xóa cookie", async () => {
    deleteOwnAccount.mockRejectedValue(new Error("Mật khẩu không chính xác"));
    const res = fakeRes();

    await deleteMe(req({ password: "sai" }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Mật khẩu không chính xác");
    expect(res.cookiesCleared).toEqual([]);
  });

  it("không tìm thấy user (vd token admin) → 404", async () => {
    deleteOwnAccount.mockRejectedValue(new Error("User not found"));
    const res = fakeRes();

    await deleteMe(req({ password: "secret" }, "admin1"), res);

    expect(res.statusCode).toBe(404);
  });
});
