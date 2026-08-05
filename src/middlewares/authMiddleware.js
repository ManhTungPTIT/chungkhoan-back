import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

// Khoảng thời gian tối thiểu giữa hai lần ghi `lastActive` của cùng một user.
const LAST_ACTIVE_THROTTLE_MS = 60_000;

export function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== "access") {
      return res.status(401).json({ message: "Invalid token type" });
    }
    req.admin = payload;

    // Heartbeat: chỉ user mới ghi nhận hiện diện (admin không nằm trong
    // collection User). Fire-and-forget — không chặn request, lỗi DB bỏ qua.
    //
    // Điều kiện thời gian nằm TRONG filter chứ không phải đọc-rồi-ghi: không khớp
    // thì Mongo không ghi gì và không sinh oplog. Cần vì heartbeat phiên gọi 5
    // lần/phút/user (xem authController.sessionStatus) — ghi mỗi request thì riêng
    // lastActive đã tốn hơn cả phần đọc của heartbeat.
    if (payload.role === "user" && payload.id) {
      const cutoff = new Date(Date.now() - LAST_ACTIVE_THROTTLE_MS);
      User.updateOne(
        {
          _id: payload.id,
          // `null` bắt luôn document CHƯA từng có field này.
          $or: [{ lastActive: { $lt: cutoff } }, { lastActive: null }],
        },
        { lastActive: new Date() },
      ).catch(() => {});
    }

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Chạy SAU verifyToken: chỉ cho phép tài khoản admin đi tiếp.
export function requireAdmin(req, res, next) {
  if (req.admin?.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}
