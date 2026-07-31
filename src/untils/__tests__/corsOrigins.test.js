// App native không chạy trên http(s) như trình duyệt: WebView của Capacitor phục
// vụ nội dung từ `capacitor://localhost` (iOS) và `https://localhost` (Android).
// Không cho hai origin này thì mọi request từ app bị CORS chặn ngay từ preflight.
import { describe, expect, it } from "vitest";
import { buildAllowedOrigins } from "../corsOrigins.js";

describe("origin được phép", () => {
  it("gồm cả hai origin của app native", () => {
    const origins = buildAllowedOrigins({});

    expect(origins).toContain("capacitor://localhost");
    expect(origins).toContain("https://localhost");
  });

  it("gồm cả http://localhost — origin khi chạy dev với CAP_DEV_HTTP", () => {
    // Dev trỏ vào backend LAN chạy http thì androidScheme hạ về `http`, WebView
    // đổi origin sang http://localhost. Thiếu origin này là đăng nhập chết ngay.
    const origins = buildAllowedOrigins({});

    expect(origins).toContain("http://localhost");
  });

  it("giữ CLIENT_URL của web", () => {
    const origins = buildAllowedOrigins({ CLIENT_URL: "https://leostock.vn" });

    expect(origins).toContain("https://leostock.vn");
  });

  it("chưa đặt CLIENT_URL thì vẫn cho dev server Vite", () => {
    const origins = buildAllowedOrigins({});

    expect(origins).toContain("http://localhost:5173");
  });

  it("CLIENT_URL nhận nhiều origin cách nhau dấu phẩy", () => {
    const origins = buildAllowedOrigins({
      CLIENT_URL: "https://leostock.vn, https://www.leostock.vn",
    });

    expect(origins).toContain("https://leostock.vn");
    expect(origins).toContain("https://www.leostock.vn");
  });

  it("không lặp origin khi CLIENT_URL trùng giá trị mặc định", () => {
    const origins = buildAllowedOrigins({ CLIENT_URL: "http://localhost:5173" });

    expect(origins.filter((o) => o === "http://localhost:5173")).toHaveLength(1);
  });
});
