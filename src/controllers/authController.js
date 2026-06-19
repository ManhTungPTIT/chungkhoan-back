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

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const { accessToken, refreshToken, admin } = await loginAdmin(username, password);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, admin });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    const { accessToken, refreshToken } = await refreshAccessToken(token);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (error) {
    clearRefreshCookie(res);
    res.status(401).json({ message: error.message });
  }
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  try {
    await logoutSession(token);
  } catch {
    // best-effort: clear the cookie regardless
  }
  clearRefreshCookie(res);
  res.status(204).end();
}

// Protected — verifyToken attached the access payload to req.admin.
export function me(req, res) {
  res.json({ admin: req.admin });
}
