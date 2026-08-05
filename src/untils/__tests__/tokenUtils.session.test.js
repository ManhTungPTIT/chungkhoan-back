// KHÔNG có thay đổi code cho test này: signTokens vốn spread `...payload` nên
// sid/platform đi qua sẵn. Viết test vì luồng refresh 4 nhánh đọc `sid` từ
// payload refresh token đã verify — nếu ai đó siết payload lại thành danh sách
// field cố định thì nhánh chống trộm mất manh mối và sẽ thu hồi nhầm phiên.
import { beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signTokens } from "../tokenUtils.js";

beforeAll(() => {
  process.env.JWT_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
});

describe("signTokens mang danh tính phiên", () => {
  it("cả access lẫn refresh đều giữ sid và platform", () => {
    const { accessToken, refreshToken } = signTokens({
      id: "u1",
      role: "user",
      sid: "sid-1",
      platform: "app",
    });

    expect(jwt.verify(accessToken, process.env.JWT_SECRET)).toMatchObject({
      sid: "sid-1",
      platform: "app",
      type: "access",
    });
    expect(jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)).toMatchObject({
      sid: "sid-1",
      platform: "app",
      type: "refresh",
    });
  });

  it("refresh token có jti riêng mỗi lần ký", () => {
    const payload = { id: "u1", role: "user", sid: "sid-1", platform: "web" };
    const a = jwt.decode(signTokens(payload).refreshToken);
    const b = jwt.decode(signTokens(payload).refreshToken);
    expect(a.jti).not.toBe(b.jti);
  });
});
