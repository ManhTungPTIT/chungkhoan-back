// Phân biệt client web với client app (Capacitor).
//
// App chạy trong WebView ở origin `capacitor://localhost` (iOS) hoặc
// `https://localhost` (Android), nên mọi request tới API là cross-origin. Cookie
// refresh đang đặt `sameSite=lax` sẽ KHÔNG được gửi kèm, và WKWebView của iOS còn
// chặn cookie bên thứ ba rất gắt. Vì vậy client app phải nhận/gửi refresh token
// qua body thay vì cookie.
//
// Dùng header thay vì User-Agent: User-Agent của WebView không đáng tin và thay
// đổi theo phiên bản hệ điều hành.
export const CLIENT_HEADER = "x-client";
export const APP_CLIENT = "app";

/** Request đến từ app native? Mặc định false → giữ nguyên luồng cookie của web. */
export function isAppClient(req) {
  const value =
    (typeof req?.get === "function" && req.get(CLIENT_HEADER)) ||
    req?.headers?.[CLIENT_HEADER];
  return value === APP_CLIENT;
}

/**
 * Lấy refresh token theo đúng kênh của từng loại client.
 *
 * Cố ý KHÔNG dùng cookie làm phương án dự phòng cho app: nếu app gửi thiếu token
 * mà ta lặng lẽ lấy cookie thì lỗi sẽ bị che, và trên máy có cookie sót lại từ
 * lần đăng nhập web sẽ sinh hành vi khó lần ra.
 */
export function readRefreshToken(req, cookieName) {
  return isAppClient(req)
    ? req?.body?.refreshToken
    : req?.cookies?.[cookieName];
}
