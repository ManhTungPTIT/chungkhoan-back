import jwt from "jsonwebtoken";

export function signTokens(payload) {
  const accessToken = jwt.sign(
    { ...payload, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );
  const refreshToken = jwt.sign(
    { ...payload, type: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d" }
  );
  return { accessToken, refreshToken };
}
