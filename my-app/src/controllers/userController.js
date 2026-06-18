import { registerUser, loginUser, getUserStats } from "../services/userService.js";
import { setRefreshCookie } from "../untils/cookieUtils.js";

export async function register(req, res) {
  const { fullName, email, password, phoneNumber } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "fullName, email and password are required" });
  }

  try {
    const result = await registerUser({ fullName, email, password, phoneNumber });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const { accessToken, refreshToken, user } = await loginUser(email, password);
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
