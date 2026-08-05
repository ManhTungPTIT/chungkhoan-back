// Mongoose dựng được schema mà không cần kết nối MongoDB, nên test này chạy khô.
// Nó khoá HÌNH DẠNG dữ liệu phiên: thiếu một field hay một index là mọi truy vấn
// "phiên đang sống" ở refreshTokenService trở thành quét toàn bảng hoặc sai.
import { describe, expect, it } from "vitest";
import { RefreshToken } from "../refreshTokenModel.js";

describe("RefreshToken — schema phiên", () => {
  it.each([
    "platform",
    "sid",
    "prevTokenHash",
    "prevUsableUntil",
    "revokedAt",
    "revokedReason",
  ])("có trường %s", (field) => {
    expect(RefreshToken.schema.path(field)).toBeTruthy();
  });

  it("platform chỉ nhận web/app, mặc định web", () => {
    const path = RefreshToken.schema.path("platform");
    expect(path.enumValues).toEqual(["web", "app"]);
    expect(path.defaultValue).toBe("web");
  });

  it("revokedReason cho phép null (phiên đang sống)", () => {
    expect(RefreshToken.schema.path("revokedReason").enumValues).toContain(null);
  });

  it("có index tìm phiên đang sống theo nền tảng", () => {
    const keys = RefreshToken.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ subjectId: 1, platform: 1, revokedAt: 1 });
  });

  it("có index cho token vừa bị xoay", () => {
    const keys = RefreshToken.schema.indexes().map(([key]) => key);
    expect(keys).toContainEqual({ prevTokenHash: 1 });
  });

  it("giữ TTL theo expiresAt — hàng đã thu hồi tự dọn, không cần job", () => {
    const ttl = RefreshToken.schema
      .indexes()
      .find(([key]) => key.expiresAt === 1);
    expect(ttl?.[1]?.expireAfterSeconds).toBe(0);
  });
});
