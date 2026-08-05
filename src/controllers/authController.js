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
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    const { accessToken, refreshToken } = await refreshAccessToken(token);
    // BE xoay vòng refresh token mỗi lần refresh và coi token cũ dùng lại là dấu
    // hiệu bị đánh cắp (authService thu hồi TOÀN BỘ phiên của chủ thể). Nên app
    // BẮT BUỘC phải nhận được token mới và ghi đè bản đang giữ.
    if (app) {
      return res.json({ accessToken, refreshToken });
    }
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (error) {
    // App không có cookie để xoá; gọi clearRefreshCookie sẽ gửi Set-Cookie thừa.
    if (!app) clearRefreshCookie(res);
    res.status(401).json({ message: error.message });
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
