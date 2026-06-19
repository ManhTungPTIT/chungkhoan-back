import {
  registerUser,
  loginUser,
  getUserStats,
  listPendingUsers,
  approveUser,
  rejectUser,
  listUsers,
  lockUser,
  unlockUser,
  deleteUser,
  setUserPackage,
} from "../services/userService.js";
import { setRefreshCookie } from "../untils/cookieUtils.js";

export async function register(req, res) {
  const { fullName, email, phoneNumber, password } = req.body;
  if (!fullName || !password || (!email && !phoneNumber)) {
    return res.status(400).json({
      message: "fullName, password and email or phone number are required",
    });
  }

  try {
    const result = await registerUser({ fullName, email, phoneNumber, password });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function login(req, res) {
  const { email, phoneNumber, password } = req.body;
  if (!password || (!email && !phoneNumber)) {
    return res
      .status(400)
      .json({ message: "Email or phone number and password are required" });
  }

  try {
    const { accessToken, refreshToken, user } = await loginUser({
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
  return runUserAction(res, () => setUserPackage(req.params.id, req.body.days));
}
