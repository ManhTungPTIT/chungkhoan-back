import bcrypt from "bcryptjs";
import { User } from "../models/userModel.js";
import { signTokens } from "../untils/tokenUtils.js";
import { saveRefreshToken } from "./refreshTokenService.js";

export async function registerUser({ fullName, email, password, phoneNumber }) {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email already in use");

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email,
    password: hashed,
    phoneNumber,
    lastActive: new Date(),
  });

  return true;
}

export async function loginUser(email, password) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Invalid credentials");

  if (user.status !== "active") throw new Error("Account is inactive");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Invalid credentials");

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
    user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
  };
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
