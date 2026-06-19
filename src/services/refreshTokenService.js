import jwt from "jsonwebtoken";
import { RefreshToken } from "../models/refreshTokenModel.js";
import { hashToken } from "../untils/tokenUtils.js";

export async function saveRefreshToken({ subjectId, role, refreshToken }) {
  const decoded = jwt.decode(refreshToken);
  return RefreshToken.create({
    subjectId,
    role,
    tokenHash: hashToken(refreshToken),
    jti: decoded.jti,
    expiresAt: new Date(decoded.exp * 1000),
  });
}

export async function findRefreshToken(refreshToken) {
  return RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
}

export async function deleteRefreshToken(refreshToken) {
  return RefreshToken.deleteOne({ tokenHash: hashToken(refreshToken) });
}

export async function revokeAllForSubject(subjectId) {
  return RefreshToken.deleteMany({ subjectId });
}
