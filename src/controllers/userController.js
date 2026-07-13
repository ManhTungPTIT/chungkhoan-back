import {
  registerUser,
  loginUser,
  getCurrentUser,
  getUserStats,
  listPendingUsers,
  approveUser,
  rejectUser,
  listUsers,
  lockUser,
  unlockUser,
  deleteUser,
  setUserPackage,
  changePassword,
  requestPackage,
  listPendingPackageRequests,
  approvePackageRequest,
  rejectPackageRequest,
} from "../services/userService.js";
import { setRefreshCookie } from "../untils/cookieUtils.js";
import jwt from "jsonwebtoken";

export async function register(req, res) {
  const { fullName, email, phoneNumber, password, broker, brokerAccount } = req.body;
  const hasBroker = broker && brokerAccount;
  if (!fullName || !password || (!email && !phoneNumber && !hasBroker)) {
    return res.status(400).json({
      message:
        "fullName, password and one of email / phone number / securities account are required",
    });
  }

  try {
    const result = await registerUser({
      fullName,
      email,
      phoneNumber,
      password,
      broker,
      brokerAccount,
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function login(req, res) {
  const { account, email, phoneNumber, password } = req.body;
  if (!password || (!account && !email && !phoneNumber)) {
    return res.status(400).json({
      message:
        "Password and account (email / phone number / securities account) are required",
    });
  }

  try {
    const { accessToken, refreshToken, user } = await loginUser({
      account,
      email,
      phoneNumber,
      password,
    });
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

//doi mat khau — danh tính lấy từ access token đã verify (req.admin.id)
export async function changePass(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ message: "Current and new password are required" });
  }
  try {
    await changePassword(req.admin.id, currentPassword, newPassword);
    res.status(200).json({ message: "Password changed" });
  } catch (error) {
    const code = error.message === "User not found" ? 404 : 400;
    res.status(code).json({ message: error.message });
  }
}

// User gửi yêu cầu đăng ký gói (chờ admin duyệt). Danh tính lấy từ token
// (req.admin.id) — KHÔNG lấy từ body. FE gửi { days }.
export async function packageRequest(req, res) {
  const { titles,days } = req.body;
  if (!days || !titles) {
    return res.status(400).json({ message: "days is required" });
  }
  try {
    const result = await requestPackage(req.admin.id,titles, days);
    res.status(201).json({ packageRequest: result });
  } catch (error) {
    const code = error.message === "User not found" ? 404 : 400;
    res.status(code).json({ message: error.message });
  }
}

// Admin: danh sách yêu cầu gói đang chờ duyệt.
export async function packageRequestsPending(req, res) {
  try {
    res.json(await listPendingPackageRequests());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Admin duyệt / từ chối yêu cầu gói theo user id (req.params.id).
export function approvePackage(req, res) {
  return runUserAction(res, () => approvePackageRequest(req.params.id));
}

export function rejectPackage(req, res) {
  return runUserAction(res, () => rejectPackageRequest(req.params.id));
}

// Thông tin của chính user đang đăng nhập. id lấy từ token (req.admin).
export async function me(req, res) {
  try {
    
    res.json(await getCurrentUser(req.admin.id));
  } catch (error) {
    const status = error.message === "User not found" ? 404 : 500;
    res.status(status).json({ message: error.message });
  }
}

// Trả { total, online, offline }. Lỗi DB → 500.
export async function stats(req, res) {
  try {
    const result = await getUserStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ─── Duyệt tài khoản (admin) ──────────────────────────────────────────────
export async function pending(req, res) {
  try {
    const result = await listPendingUsers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function approve(req, res) {
  try {
    const result = await approveUser(req.params.id);
    res.json(result);
  } catch (error) {
    const status = error.message === "User not found" ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
}

export async function reject(req, res) {
  try {
    const result = await rejectUser(req.params.id);
    res.json(result);
  } catch (error) {
    const status = error.message === "User not found" ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
}

// ─── Quản lý người dùng (admin) ───────────────────────────────────────────
export async function list(req, res) {
  try {
    res.json(await listUsers());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Helper chung cho các thao tác theo id → chuẩn hóa mã lỗi.
async function runUserAction(res, action) {
  try {
    res.json(await action());
  } catch (error) {
    const code = error.message === "User not found" ? 404 : 400;
    res.status(code).json({ message: error.message });
  }
}

export function lock(req, res) {
  return runUserAction(res, () => lockUser(req.params.id));
}

export function unlock(req, res) {
  return runUserAction(res, () => unlockUser(req.params.id));
}

export function remove(req, res) {
  return runUserAction(res, () => deleteUser(req.params.id));
}

export function setPackage(req, res) {
  return runUserAction(res, () => setUserPackage(req.params.id, req.body.titles ,req.body.days));
}
