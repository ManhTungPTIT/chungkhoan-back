import bcrypt from "bcryptjs";
import { User } from "../models/userModel.js";
import {Admin} from "../models/adminModel.js"
import { signTokens } from "../untils/tokenUtils.js";
import { saveRefreshToken } from "./refreshTokenService.js";

export async function registerUser({ fullName, email, phoneNumber, password }) {
  if (!email && !phoneNumber) {
    throw new Error("Email or phone number is required");
  }

  // Kiểm trùng theo trường được gửi (email hoặc số điện thoại)
  const query = email ? { email } : { phoneNumber };
  const existing = await User.findOne(query);
  if (existing) throw new Error("Account already exists");

  const hashed = await bcrypt.hash(password, 12);
  await User.create({
    fullName,
    email,
    phoneNumber,
    password: hashed,
    status: "pending", // chờ admin duyệt mới đăng nhập được
    lastActive: new Date(),
  });

  return { status: "pending" };
}

export async function loginUser({ email, phoneNumber, password }) {
  const query = email ? { email } : { phoneNumber };
  const user = await User.findOne(query);
  if (!user) throw new Error("Invalid credentials");

  // Kiểm mật khẩu trước để không lộ trạng thái cho người sai mật khẩu
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  if (user.status === "pending") throw new Error("Account pending approval");
  if (user.status === "rejected") throw new Error("Account has been rejected");
  if (user.status !== "active") throw new Error("Account is inactive");

  // Quá hạn gói → chặn đăng nhập (null = không giới hạn)
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    throw new Error("Account expired");
  }

  user.lastActive = new Date();
  await user.save();

  const { accessToken, refreshToken } = signTokens({
    id: user._id,
    email: user.email,
    role: user.role,
  });
  await saveRefreshToken({ subjectId: user._id, role: user.role, refreshToken });

  return {
    accessToken,
    refreshToken,
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, phoneNumber: user.phoneNumber, avatarUrl: user.avatarUrl },
  };
}

// Thông tin của chính user đang đăng nhập (cho trang InfoUser). Chỉ lấy các
// trường cần hiển thị — không kéo password.
export async function getCurrentUser(id) {
  const user = await User.findById(id);
  const admin = await Admin.findById(id);
  console.log(admin)
  if (!user && !admin) throw new Error("User not found");
  if(user) return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    avatarUrl: user.avatarUrl,
  };
  else{
    throw new Error("You are admin")
  }
}

// Thống kê người dùng. online = có lastActive trong vòng ONLINE_WINDOW_MS gần
// đây (mặc định 5 phút). offline = phần còn lại. Tính online bằng truy vấn
// riêng (không tải toàn bộ doc) để nhẹ khi số lượng user lớn.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export async function getUserStats() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [total, online] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastActive: { $gte: since } }),
  ]);
  return { total, online, offline: total - online };
}

// ─── Duyệt tài khoản (admin) ──────────────────────────────────────────────
// Danh sách tài khoản đang chờ duyệt.
export async function listPendingUsers() {
  const users = await User.find(
    { status: "pending" },
    "fullName email phoneNumber createdAt",
  );
  return users.map((u) => ({
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    createdAt: u.createdAt,
  }));
}

export async function approveUser(id) {
  const user = await User.findByIdAndUpdate(
    id,
    { status: "active" },
    { new: true },
  );
  if (!user) throw new Error("User not found");
  return { id: user._id, status: user.status };
}

export async function rejectUser(id) {
  const user = await User.findByIdAndUpdate(
    id,
    { status: "rejected" },
    { new: true },
  );
  if (!user) throw new Error("User not found");
  return { id: user._id, status: user.status };
}

// ─── Quản lý người dùng (admin) ───────────────────────────────────────────
// Toàn bộ user trừ những bản ghi đã xóa (soft delete).
export async function listUsers() {
  const users = await User.find(
    { status: { $ne: "deleted" } },
    "fullName email phoneNumber status createdAt expiresAt lastActive",
  ).sort({ createdAt: -1 });
  return users.map((u) => ({
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    status: u.status,
    createdAt: u.createdAt,
    expiresAt: u.expiresAt,
    lastActive: u.lastActive,
  }));
}

async function setStatus(id, status) {
  const user = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (!user) throw new Error("User not found");
  return { id: user._id, status: user.status };
}

export function lockUser(id) {
  return setStatus(id, "locked");
}

export function unlockUser(id) {
  return setStatus(id, "active");
}

// Soft delete: giữ bản ghi, chỉ đánh dấu deleted.
export function deleteUser(id) {
  return setStatus(id, "deleted");
}

// Gia hạn gói: cộng dồn vào hạn còn lại nếu user CHƯA hết hạn, ngược lại
// (đã hết hạn hoặc chưa có gói) thì tính từ hôm nay. Tránh làm mất số ngày
// còn lại khi admin gia hạn cho tài khoản vẫn đang hiệu lực.
export async function setUserPackage(id, days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid package");

  const user = await User.findById(id);
  if (!user) throw new Error("User not found");

  const now = Date.now();
  const current = user.expiresAt ? new Date(user.expiresAt).getTime() : 0;
  const base = current > now ? current : now;
  user.expiresAt = new Date(base + n * 24 * 60 * 60 * 1000);
  await user.save();

  return { id: user._id, expiresAt: user.expiresAt };
}
