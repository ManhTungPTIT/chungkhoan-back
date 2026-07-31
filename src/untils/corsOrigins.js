// Origin của app native KHÔNG phải http(s) như trình duyệt:
//   iOS     → capacitor://localhost
//   Android → https://localhost   (androidScheme mặc định)
//           → http://localhost    (khi chạy dev với CAP_DEV_HTTP=1 để gọi backend
//                                  LAN chạy http — xem App/capacitor.config.js)
// Thiếu các origin này thì mọi request từ app chết ngay ở preflight CORS.
//
// `localhost` ở đây là origin NỘI BỘ của WebView, không phải máy chủ nào ngoài
// mạng, nên cho phép cả bản http không nới lỏng gì thêm về bảo mật.
const APP_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
];

const DEFAULT_WEB_ORIGIN = "http://localhost:5173";

/**
 * Danh sách origin được phép gọi API.
 *
 * `CLIENT_URL` nhận nhiều origin cách nhau dấu phẩy để phục vụ trường hợp có cả
 * tên miền chính lẫn bản www hoặc môi trường staging.
 */
export function buildAllowedOrigins(env = process.env) {
  const configured = String(env.CLIENT_URL || DEFAULT_WEB_ORIGIN)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return [...new Set([...configured, ...APP_ORIGINS])];
}
