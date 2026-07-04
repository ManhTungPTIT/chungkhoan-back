// Test luồng gói dịch vụ trong userService — mock model, không cần MongoDB.
// Regression cho chuỗi bug 04/07/2026: field titles lệch tên, packageRequest
// null làm crash login/setUserPackage, /user/me thiếu expiresAt.
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
  saveRefreshToken: vi.fn(async () => {}),
}));

import { User } from "../../models/userModel.js";
import { Admin } from "../../models/adminModel.js";
import {
  loginUser,
  setUserPackage,
  getCurrentUser,
  listPendingPackageRequests,
} from "../userService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function fakeUser(overrides = {}) {
  return {
    _id: "u1",
    fullName: "Nguyen Van A",
    email: "a@example.com",
    role: "user",
    phoneNumber: null,
    avatarUrl: "avatar.jpg",
    status: "active",
    expiresAt: null,
    packageRequest: null,
    save: vi.fn(async function () {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginUser — packageTitle (gói đang dùng)", () => {
  it("đăng nhập được khi user CHƯA từng yêu cầu gói (packageRequest null)", async () => {
    const password = await bcrypt.hash("secret", 4);
    User.findOne.mockResolvedValue(fakeUser({ password }));

    const result = await loginUser({ email: "a@example.com", password: "secret" });

    expect(result.user.packageTitle).toBeNull();
    expect(result.accessToken).toBe("at");
  });

  it("chỉ trả tên gói khi yêu cầu ĐÃ được duyệt — pending/rejected không phải gói đang dùng", async () => {
    const password = await bcrypt.hash("secret", 4);
    User.findOne.mockResolvedValue(
      fakeUser({
        password,
        packageRequest: { titles: "90 ngày", days: 90, status: "pending" },
      }),
    );
    const pending = await loginUser({ email: "a@example.com", password: "secret" });
    expect(pending.user.packageTitle).toBeNull();

    User.findOne.mockResolvedValue(
      fakeUser({
        password,
        packageRequest: { titles: "90 ngày", days: 90, status: "approved" },
      }),
    );
    const approved = await loginUser({ email: "a@example.com", password: "secret" });
    expect(approved.user.packageTitle).toBe("90 ngày");
  });
});

describe("setUserPackage — admin đặt gói tay", () => {
  it("không crash khi user chưa từng yêu cầu gói: ghi gói approved + cộng hạn", async () => {
    const user = fakeUser();
    User.findById.mockResolvedValue(user);
    const before = Date.now();

    const result = await setUserPackage("u1", "90 ngày", 90);

    expect(user.packageRequest).toMatchObject({
      titles: "90 ngày",
      days: 90,
      status: "approved",
    });
    expect(new Date(user.expiresAt).getTime()).toBeGreaterThanOrEqual(
      before + 90 * DAY_MS,
    );
    expect(user.save).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "u1" });
  });

  it("cộng dồn vào hạn còn lại khi user đang còn hạn", async () => {
    const current = new Date(Date.now() + 10 * DAY_MS);
    const user = fakeUser({
      expiresAt: current,
      packageRequest: { titles: "30 ngày", days: 30, status: "approved" },
    });
    User.findById.mockResolvedValue(user);

    await setUserPackage("u1", "90 ngày", 90);

    expect(new Date(user.expiresAt).getTime()).toBe(
      current.getTime() + 90 * DAY_MS,
    );
    expect(user.packageRequest.titles).toBe("90 ngày");
  });
});

describe("getCurrentUser — /user/me", () => {
  it("trả expiresAt + packageRequest để FE hiển thị gói đang dùng và hạn", async () => {
    const expires = new Date("2026-12-31T00:00:00.000Z");
    User.findById.mockResolvedValue(
      fakeUser({
        expiresAt: expires,
        packageRequest: { titles: "90 ngày", days: 90, status: "approved" },
      }),
    );
    Admin.findById.mockResolvedValue(null);

    const me = await getCurrentUser("u1");

    expect(me.expiresAt).toEqual(expires);
    expect(me.packageRequest.titles).toBe("90 ngày");
  });
});

describe("listPendingPackageRequests — bảng gói chờ duyệt của admin", () => {
  it("kèm titles để admin thấy tên gói được yêu cầu", async () => {
    const requestedAt = new Date();
    User.find.mockResolvedValue([
      fakeUser({
        packageRequest: {
          titles: "1 năm",
          days: 365,
          status: "pending",
          requestedAt,
        },
      }),
    ]);

    const rows = await listPendingPackageRequests();

    expect(rows[0]).toMatchObject({ titles: "1 năm", days: 365, requestedAt });
  });
});
