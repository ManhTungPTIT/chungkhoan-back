import bcrypt from "bcryptjs";
import { User } from "../models/userModel.js";
import {Admin} from "../models/adminModel.js"
import { signTokens } from "../untils/tokenUtils.js";
import {
  createSession,
  newSessionId,
  revokeLivePlatformSessions,
} from "./refreshTokenService.js";

export async function registerUser({
  fullName,
  email,
  phoneNumber,
  password,
  broker,
  brokerAccount,
}) {
  const hasBroker = broker && brokerAccount;
  if (!email && !phoneNumber && !hasBroker) {
    throw new Error("Email, phone number or securities account is required");
  }
  if (broker && !["VPS", "TCBS"].includes(broker)) {
    throw new Error("Invalid broker");
  }

  // Kiểm trùng theo định danh được gửi (email → phone → số TK toàn cục)
  const query = email
    ? { email }
    : phoneNumber
    ? { phoneNumber }
    : { brokerAccount };
  const existing = await User.findOne(query);
  if (existing) throw new Error("Account already exists");

  const hashed = await bcrypt.hash(password, 12);
  await User.create({
    fullName,
    email,
    phoneNumber,
    broker: hasBroker ? broker : undefined,
    brokerAccount: hasBroker ? brokerAccount : undefined,
    password: hashed,
    status: "pending", // chờ admin duyệt mới đăng nhập được
    lastActive: new Date(),
  });

  return { status: "pending" };
}

export async function loginUser({
  account,
  email,
  phoneNumber,
  password,
  platform = "web",
}) {
  // account = 1 chuỗi tự do (email / SĐT / số TK) — dò cả 3 field, giống hệt
  // cách email/phone hoạt động (email lưu lowercase nên so khớp bản thường hoá).
  // Vẫn nhận email/phoneNumber rời để tương thích caller cũ.
  let query;
  if (account) {
    const id = String(account).trim();
    query = {
      $or: [
        { email: id.toLowerCase() },
        { phoneNumber: id },
        { brokerAccount: id },
      ],
    };
  } else {
    query = email ? { email } : { phoneNumber };
  }
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

  const sid = newSessionId();

  // Chống chia sẻ tài khoản: mỗi user tối đa 1 phiên web + 1 phiên app. Đá phiên
  // cũ CÙNG nền tảng, không đụng nền tảng kia. Phải chạy TRƯỚC khi tạo phiên mới
  // — đảo thứ tự là tự đá luôn phiên vừa tạo.
  await revokeLivePlatformSessions({ subjectId: user._id, platform });

  const { accessToken, refreshToken } = signTokens({
    id: user._id,
    email: user.email,
    role: user.role,
    sid,
    platform,
  });
  await createSession({
    subjectId: user._id,
    role: user.role,
    platform,
    sid,
    refreshToken,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      // Gói đang dùng = yêu cầu ĐÃ duyệt. packageRequest có thể null (chưa từng
      // yêu cầu) hoặc pending/rejected — các trạng thái đó chưa phải gói đang dùng.
      packageTitle: activePackageTitle(user),
    },
  };
}

//doi mat khau — tra cứu theo id, kiểm mật khẩu hiện tại, hash mật khẩu mới
export async function changePassword(id, currentPassword, newPassword) {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new Error("Mật khẩu hiện tại không chính xác");

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return true;
}

// Tên gói đang dùng của user: chỉ tính yêu cầu ĐÃ được duyệt; chưa từng yêu cầu
// (null) hoặc đang pending/rejected → null. Dùng cho payload login.
function activePackageTitle(user) {
  const req = user.packageRequest;
  return req?.status === "approved" ? req.titles ?? null : null;
}

// Cộng `days` vào hạn gói: còn hạn → cộng dồn số ngày còn lại, đã hết/chưa có →
// tính từ hôm nay. Dùng chung cho duyệt yêu cầu gói và admin đặt gói tay.
function extendExpiry(user, days) {
  const now = Date.now();
  const current = user.expiresAt ? new Date(user.expiresAt).getTime() : 0;
  const base = current > now ? current : now;
  user.expiresAt = new Date(base + days * 24 * 60 * 60 * 1000);
}

// Người dùng gửi yêu cầu đăng ký gói (chờ admin duyệt). FE gửi { days }. Ghi đè
// yêu cầu cũ nếu có. CHƯA đụng expiresAt — chỉ áp khi admin duyệt.
export async function requestPackage(id,titles, days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid package");

  const user = await User.findById(id);
  if (!user) throw new Error("User not found");

  user.packageRequest = { titles: titles , days: n, status: "pending", requestedAt: new Date() };
  await user.save();

  return user.packageRequest;
}

// Danh sách yêu cầu gói đang chờ duyệt (cho admin). id = user._id vì mỗi user chỉ
// có một yêu cầu tại một thời điểm.
export async function listPendingPackageRequests() {
  const users = await User.find(
    { "packageRequest.status": "pending" },
    "fullName email phoneNumber packageRequest",
  ).sort({ createdAt: -1 });
  return users.map((u) => ({
    id: u._id,
    user: {
      id: u._id,
      fullName: u.fullName,
      email: u.email,
      phoneNumber: u.phoneNumber,
    },
    titles: u.packageRequest.titles,
    days: u.packageRequest.days,
    requestedAt: u.packageRequest.requestedAt,
  }));
}

// Admin duyệt yêu cầu gói: cộng days vào expiresAt (cộng dồn), đánh dấu approved.
export async function approvePackageRequest(id) {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  if (user.packageRequest?.status !== "pending") {
    throw new Error("No pending package request");
  }
  extendExpiry(user, user.packageRequest.days);
  user.packageRequest.status = "approved";
  await user.save();
  return {
    id: user._id,
    expiresAt: user.expiresAt,
    status: user.packageRequest.status,
  };
}

// Admin từ chối yêu cầu gói.
export async function rejectPackageRequest(id) {
  const user = await User.findById(id);
  if (!user) throw new Error("User not found");
  if (user.packageRequest?.status !== "pending") {
    throw new Error("No pending package request");
  }
  user.packageRequest.status = "rejected";
  await user.save();
  return { id: user._id, status: user.packageRequest.status };
}

// Thông tin của chính user đang đăng nhập (cho trang InfoUser). Chỉ lấy các
// trường cần hiển thị — không kéo password.
export async function getCurrentUser(id) {
  const user = await User.findById(id);
  const admin = await Admin.findById(id);
  
  if (!user && !admin) throw new Error("User not found");
  if (user) return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    avatarUrl: user.avatarUrl,
    packageRequest: user.packageRequest,
    // Hạn gói để FE hiển thị "Hết hạn" — thiếu field này InfoUser luôn "Chưa có".
    expiresAt: user.expiresAt,
  };
  return {
    id: admin._id,
    username: admin.username,
    role: admin.role,
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

// ─── Duyệt tài khoản (admin) ──────────────────────────────────────────────
// Danh sách tài khoản đang chờ duyệt.
export async function listPendingUsers() {
  const users = await User.find(
    { status: "pending" },
    "fullName email phoneNumber broker brokerAccount createdAt",
  ).sort({ createdAt: -1 });
  return users.map((u) => ({
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    broker: u.broker,
    brokerAccount: u.brokerAccount,
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
    { status: { $nin: ["pending", "deleted" ]  },

   },
    "fullName email phoneNumber broker brokerAccount status createdAt expiresAt lastActive",
  ).sort({ createdAt: -1 });
  return users.map((u) => ({
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    phoneNumber: u.phoneNumber,
    broker: u.broker,
    brokerAccount: u.brokerAccount,
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
// Admin đặt gói tay = gói đã duyệt: ghi đè packageRequest (kể cả khi null —
// user chưa từng yêu cầu) thành bản ghi approved để mọi nơi đọc "gói đang dùng"
// theo cùng một quy tắc (status === "approved").
export async function setUserPackage(id, titles, days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid package");

  const user = await User.findById(id);
  if (!user) throw new Error("User not found");

  extendExpiry(user, n);
  user.packageRequest = {
    titles,
    days: n,
    status: "approved",
    requestedAt: new Date(),
  };
  await user.save();

  return { id: user._id, expiresAt: user.expiresAt };
}
