import {
  loginAdmin,
  refreshAccessToken,
  logoutSession,
} from "../services/authService.js";
import {
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "../untils/cookieUtils.js";
import { isAppClient, readPlatform, readRefreshToken } from "../untils/clientType.js";
import { AUTH_ERROR } from "../untils/authErrors.js";
import { findSessionBySid } from "../services/refreshTokenService.js";

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const { accessToken, refreshToken, admin } = await loginAdmin(username, password, {
      platform: readPlatform(req),
    });
    // App không nhận được cookie cross-origin → trả refresh token trong body để
    // app tự cất vào secure storage (xem untils/clientType.js).
    if (isAppClient(req)) {
      return res.json({ accessToken, refreshToken, admin });
    }
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, admin });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

export async function refresh(req, res) {
  const app = isAppClient(req);
  const token = readRefreshToken(req, REFRESH_COOKIE_NAME);
  if (!token) {
    return res.status(401).json({
      code: AUTH_ERROR.INVALID_TOKEN,
      message: "Refresh token is required",
    });
  }

  try {
    const { accessToken, refreshToken } = await refreshAccessToken(token);
    // BE xoay vòng refresh token mỗi lần refresh, nên app BẮT BUỘC phải nhận
    // được token mới và ghi đè bản đang giữ.
    //
    // Trừ nhánh ân hạn (hai tab đua nhau): nó KHÔNG trả refresh token vì bản mới
    // đã nằm trong cookie/secure storage rồi — ghi đè bằng undefined ở đây là tự
    // đăng xuất người dùng.
    if (app) {
      return res.json(refreshToken ? { accessToken, refreshToken } : { accessToken });
    }
    if (refreshToken) setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (error) {
    // App không có cookie để xoá; gọi clearRefreshCookie sẽ gửi Set-Cookie thừa.
    if (!app) clearRefreshCookie(res);
    res.status(401).json({
      code: error.code ?? AUTH_ERROR.INVALID_TOKEN,
      message: error.message,
    });
  }
}

export async function logout(req, res) {
  const app = isAppClient(req);
  const token = readRefreshToken(req, REFRESH_COOKIE_NAME);
  try {
    await logoutSession(token);
  } catch {
    // best-effort: vẫn dọn phía client dù thu hồi ở server thất bại
  }
  if (!app) clearRefreshCookie(res);
  res.status(204).end();
}

// Protected — verifyToken attached the access payload to req.admin.
export function me(req, res) {
  res.json({ admin: req.admin });
}

// Heartbeat phiên: FE gọi mỗi ~12s để biết mình còn được đăng nhập không.
//
// Đây là nơi DUY NHẤT của chart_back tra DB theo access token — các API khác giữ
// nguyên stateless. Nó tồn tại vì server KHÔNG đẩy được tin cho máy bị đá (Express
// thuần, không WS/SSE), mà màn hình chính lấy dữ liệu từ BE Python nên tự nó
// chẳng bao giờ gọi tới đây. Xem specs 2026-08-05-session-instant-kick-design.md.
//
// KHÔNG xử lý gì thêm khi 401: interceptor của FE sẽ thử /auth/refresh, nhánh 2 ở
// đó trả SESSION_SUPERSEDED rồi tự dọn token và chuyển về /login kèm lý do.
export async function sessionStatus(req, res) {
  const sid = req.admin?.sid;
  // Token cấp trước khi có khái niệm phiên: coi như còn sống, để deploy không
  // đăng xuất toàn bộ người đang dùng. Chúng tự hết trong 7 ngày.
  if (!sid) return res.json({ alive: true });

  const session = await findSessionBySid(sid);
  if (!session) {
    return res.status(401).json({
      code: AUTH_ERROR.INVALID_TOKEN,
      message: "Invalid or expired refresh token",
    });
  }
  if (!session.revokedAt) return res.json({ alive: true });

  if (session.revokedReason === "superseded") {
    return res.status(401).json({
      code: AUTH_ERROR.SESSION_SUPERSEDED,
      message: "Tài khoản đã đăng nhập ở thiết bị khác",
    });
  }
  return res.status(401).json({
    code: AUTH_ERROR.INVALID_TOKEN,
    message: "Invalid or expired refresh token",
  });
}
