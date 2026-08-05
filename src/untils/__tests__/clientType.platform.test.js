// Nền tảng quyết định "chỗ ngồi" của phiên: mỗi tài khoản 1 ghế web + 1 ghế app.
// Vì vậy tập giá trị PHẢI đóng — nhận bừa "ios"/"app2" là mở thêm ghế, tức thủng
// trần phiên. Bộ test này khoá đúng chuyện đó.
import { describe, expect, it } from "vitest";
import { readPlatform } from "../clientType.js";

function fakeReq(headers = {}) {
  return {
    headers,
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
}

describe("readPlatform", () => {
  it('header "x-client: app" → app', () => {
    expect(readPlatform(fakeReq({ "x-client": "app" }))).toBe("app");
  });

  it("không có header → web", () => {
    expect(readPlatform(fakeReq())).toBe("web");
  });

  it("request không có hàm get (chỉ headers) vẫn đọc được", () => {
    expect(readPlatform({ headers: { "x-client": "app" } })).toBe("app");
  });

  it.each(["ios", "android", "app2", "APP", "web", "", " app"])(
    "giá trị lạ %j → web, không mở thêm ghế",
    (value) => {
      expect(readPlatform(fakeReq({ "x-client": value }))).toBe("web");
    },
  );
});
