import crypto from "crypto";
import jwt from "jsonwebtoken";

export function signTokens(payload) {
  const accessToken = jwt.sign(
    { ...payload, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );
  const refreshToken = jwt.sign(
    { ...payload, type: "refresh", jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );
  return { accessToken, refreshToken };
}

// sha256 hex of a token — we store this, never the raw token
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
