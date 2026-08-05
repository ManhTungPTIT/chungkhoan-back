import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/adminModel.js";
import { signTokens } from "../untils/tokenUtils.js";
import {
  createSession,
  findSessionByPrevToken,
  findSessionByToken,
  newSessionId,
  revokeSession,
  revokeSessionByToken,
  rotateSessionToken,
} from "./refreshTokenService.js";
import { AUTH_ERROR, authError } from "../untils/authErrors.js";

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

/**
 * Bốn nhánh, xem specs 2026-08-05-session-platform-login-design.md:
 *   1. token khớp phiên đang sống      → xoay vòng tại chỗ
 *   2. token khớp phiên ĐÃ thu hồi     → báo lý do, KHÔNG đụng phiên khác
 *   3. token vừa bị xoay, còn ân hạn   → cấp access token, không xoay tiếp
 *   4. không khớp gì                   → dùng lại token thật, thu hồi phiên đó
 */
export async function refreshAccessToken(presentedToken) {
  let payload;
  try {
    payload = jwt.verify(presentedToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw authError(AUTH_ERROR.INVALID_TOKEN, "Invalid or expired refresh token");
  }
  if (payload.type !== "refresh") {
    throw authError(AUTH_ERROR.INVALID_TOKEN, "Invalid token type");
  }

  const identity = { id: payload.id, role: payload.role };
  if (payload.username) identity.username = payload.username;
  if (payload.email) identity.email = payload.email;

  const session = await findSessionByToken(presentedToken);

  // Nhánh 1 — phiên bình thường.
  if (session && !session.revokedAt) {
    const { accessToken, refreshToken } = signTokens({
      ...identity,
      sid: session.sid,
      // `?? "web"` cho hàng tạo trước thay đổi này: chúng không có field
      // platform, và `default` của schema chỉ áp cho document mới.
      platform: session.platform ?? "web",
    });
    await rotateSessionToken(session, refreshToken);
    return { accessToken, refreshToken };
  }

  // Nhánh 2 — phiên đã chết. Chỉ "superseded" mới là bị đá; "logout"/"reuse" là
  // lỗi token thường, nói "đã đăng nhập ở thiết bị khác" là sai sự thật.
  if (session) {
    if (session.revokedReason === "superseded") {
      throw authError(
        AUTH_ERROR.SESSION_SUPERSEDED,
        "Tài khoản đã đăng nhập ở thiết bị khác",
      );
    }
    throw authError(AUTH_ERROR.INVALID_TOKEN, "Invalid or expired refresh token");
  }

  // Nhánh 3 — hai tab đua nhau. KHÔNG trả refresh token mới: DB chỉ giữ hash nên
  // không phát lại được token hiện hành, mà cũng không cần — trình duyệt đã nhận
  // cookie mới từ tab thắng cuộc, tab thua chỉ thiếu mỗi access token.
  const racing = await findSessionByPrevToken(presentedToken);
  if (racing) {
    const { accessToken } = signTokens({
      ...identity,
      sid: racing.sid,
      platform: racing.platform ?? "web",
    });
    return { accessToken };
  }

  // Nhánh 4 — dùng lại token cũ thật. Thu hồi ĐÚNG phiên đó (token family của
  // OAuth), không phải cả tài khoản: token web rò rỉ không được đá văng app.
  if (payload.sid) {
    await revokeSession({ sid: payload.sid, reason: "reuse" });
  }
  throw authError(AUTH_ERROR.INVALID_TOKEN, "Invalid or expired refresh token");
}

// Đánh dấu chứ không xoá: hàng còn lại là thứ duy nhất cho nhánh 2 của refresh
// biết đây là "tự đăng xuất" chứ không phải "bị đá".
export async function logoutSession(refreshToken) {
  if (!refreshToken) return;
  await revokeSessionByToken(refreshToken, "logout");
}
