import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/adminModel.js";
import { signTokens } from "../untils/tokenUtils.js";
import {
  createSession,
  newSessionId,
  findRefreshToken,
  deleteRefreshToken,
  revokeAllForSubject,
} from "./refreshTokenService.js";

// Admin KHÔNG bị giới hạn phiên (xem specs 2026-08-05): vẫn ghi platform/sid để
// tra log, nhưng không đá phiên cũ.
export async function loginAdmin(username, password, { platform = "web" } = {}) {
  const admin = await Admin.findOne({ username : username  });

  if (!admin) throw new Error("Tài khoản sai");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) throw new Error("mật khẩu sai");

  const sid = newSessionId();
  const { accessToken, refreshToken } = signTokens({
    id: admin._id,
    username: admin.username,
    role: admin.role,
    sid,
    platform,
  });
  await createSession({
    subjectId: admin._id,
    role: admin.role,
    platform,
    sid,
    refreshToken,
  });

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
  await createSession({
    subjectId: payload.id,
    role: payload.role,
    platform: payload.platform ?? "web",
    sid: payload.sid ?? newSessionId(),
    refreshToken,
  });

  return { accessToken, refreshToken };
}

export async function logoutSession(refreshTokenFromCookie) {
  if (!refreshTokenFromCookie) return;
  await deleteRefreshToken(refreshTokenFromCookie);
}
