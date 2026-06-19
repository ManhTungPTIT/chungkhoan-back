import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

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
    if (payload.role === "user" && payload.id) {
      User.updateOne({ _id: payload.id }, { lastActive: new Date() }).catch(
        () => {},
      );
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
