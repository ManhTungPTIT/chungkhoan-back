import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/adminModel.js";
import { signTokens } from "../untils/tokenUtils.js";
import {
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  revokeAllForSubject,
} from "./refreshTokenService.js";

export async function loginAdmin(username, password) {
  const admin = await Admin.findOne({ username });
  if (!admin) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) throw new Error("Invalid credentials");

  const { accessToken, refreshToken } = signTokens({
    id: admin._id,
    username: admin.username,
    role: admin.role,
  });
  await saveRefreshToken({ subjectId: admin._id, role: admin.role, refreshToken });

  return {
    accessToken,
    refreshToken,
    admin: { id: admin._id, username: admin.username, role: admin.role },
  };
}

// Verify the cookie's refresh JWT, confirm it is still in the DB, then rotate.
// Reuse of an already-rotated (valid but deleted) token → revoke the family.
export async function refreshAccessToken(refreshTokenFromCookie) {
  let payload;
  try {
    payload = jwt.verify(refreshTokenFromCookie, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const stored = await findRefreshToken(refreshTokenFromCookie);
  if (!stored) {
    // Token signature is valid but it's not in the DB → it was already rotated.
    // Treat as theft: kill every session for this subject.
    await revokeAllForSubject(payload.id);
    throw new Error("Invalid or expired refresh token");
  }

  await deleteRefreshToken(refreshTokenFromCookie);

  const tokenPayload = { id: payload.id, role: payload.role };
  if (payload.username) tokenPayload.username = payload.username;
  if (payload.email) tokenPayload.email = payload.email;

  const { accessToken, refreshToken } = signTokens(tokenPayload);
  await saveRefreshToken({ subjectId: payload.id, role: payload.role, refreshToken });

  return { accessToken, refreshToken };
}

export async function logoutSession(refreshTokenFromCookie) {
  if (!refreshTokenFromCookie) return;
  await deleteRefreshToken(refreshTokenFromCookie);
}
