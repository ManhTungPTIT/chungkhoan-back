import crypto from "crypto";
import jwt from "jsonwebtoken";
import { RefreshToken } from "../models/refreshTokenModel.js";
import { hashToken } from "../untils/tokenUtils.js";

// Cửa sổ ân hạn cho token vừa bị xoay.
//
// Hai tab cùng trình duyệt dùng CHUNG cookie refresh, nên chúng có thể gọi
// /auth/refresh gần như đồng thời: tab thắng xoay vòng token, tab thua trình
// token đã bị xoay. Không có cửa sổ này thì tab thua bị coi là dùng lại token cũ
// và cả phiên bị thu hồi oan.
export const ROTATION_GRACE_MS = 30_000;

export function newSessionId() {
  return crypto.randomUUID();
}

export async function createSession({ subjectId, role, platform, sid, refreshToken }) {
  const decoded = jwt.decode(refreshToken);
  return RefreshToken.create({
    subjectId,
    role,
    platform,
    sid,
    tokenHash: hashToken(refreshToken),
    jti: decoded.jti,
    expiresAt: new Date(decoded.exp * 1000),
  });
}

/**
 * Hàng phiên đang giữ token này — KỂ CẢ đã thu hồi.
 *
 * Cố ý không lọc `revokedAt`: caller cần đọc `revokedReason` để phân biệt "bị
 * đá" (báo SESSION_SUPERSEDED) với "tự đăng xuất" (báo lỗi token thường).
 */
export async function findSessionByToken(refreshToken) {
  return RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
}

/** Phiên còn sống mà token này VỪA bị xoay khỏi, còn trong cửa sổ ân hạn. */
export async function findSessionByPrevToken(refreshToken) {
  return RefreshToken.findOne({
    prevTokenHash: hashToken(refreshToken),
    prevUsableUntil: { $gt: new Date() },
    revokedAt: null,
  });
}

/** Xoay vòng TẠI CHỖ — cùng một document, `sid` không đổi. */
export async function rotateSessionToken(session, nextRefreshToken) {
  const decoded = jwt.decode(nextRefreshToken);
  await RefreshToken.updateOne(
    { _id: session._id },
    {
      $set: {
        prevTokenHash: session.tokenHash,
        prevUsableUntil: new Date(Date.now() + ROTATION_GRACE_MS),
        tokenHash: hashToken(nextRefreshToken),
        jti: decoded.jti,
        expiresAt: new Date(decoded.exp * 1000),
      },
    },
  );
}

/**
 * Đá mọi phiên đang sống của tài khoản trên ĐÚNG nền tảng này.
 *
 * Đánh dấu chứ không xoá: hàng còn lại là thứ duy nhất cho thiết bị bị đá biết
 * nó "bị thay thế" chứ không phải "token bị đánh cắp".
 */
export async function revokeLivePlatformSessions({
  subjectId,
  platform,
  reason = "superseded",
}) {
  await RefreshToken.updateMany(
    { subjectId, platform, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Thu hồi đúng một phiên theo `sid` — phạm vi token family của OAuth. */
export async function revokeSession({ sid, reason }) {
  await RefreshToken.updateMany(
    { sid, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

export async function revokeSessionByToken(refreshToken, reason = "logout") {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

// ─── Cầu tạm ───────────────────────────────────────────────────────────────
// Giữ để authService/userService chưa sửa vẫn chạy. Task 4 gỡ saveRefreshToken,
// Task 5 gỡ ba hàm còn lại. KHÔNG dùng cho code mới.

/** @deprecated dùng findSessionByToken */
export async function findRefreshToken(refreshToken) {
  return RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
}

/** @deprecated dùng revokeSessionByToken */
export async function deleteRefreshToken(refreshToken) {
  return RefreshToken.deleteOne({ tokenHash: hashToken(refreshToken) });
}

/** @deprecated dùng revokeSession — thu hồi cả tài khoản là quá tay */
export async function revokeAllForSubject(subjectId) {
  return RefreshToken.deleteMany({ subjectId });
}
