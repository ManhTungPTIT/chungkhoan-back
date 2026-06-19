import jwt from "jsonwebtoken";

export const REFRESH_COOKIE_NAME = "refreshToken";

// Fallback only: used when the refresh token has no decodable exp claim.
// Keep in sync with REFRESH_TOKEN_EXPIRES_IN (default 7d)
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Read env at call time so tests can flip NODE_ENV between cases
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

export function setRefreshCookie(res, token) {
  const opts = refreshCookieOptions();
  const decoded = jwt.decode(token);
  if (decoded?.exp) {
    opts.maxAge = decoded.exp * 1000 - Date.now();
  }
  res.cookie(REFRESH_COOKIE_NAME, token, opts);
}

export function clearRefreshCookie(res) {
  const { httpOnly, secure, sameSite, path } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly, secure, sameSite, path });
}
