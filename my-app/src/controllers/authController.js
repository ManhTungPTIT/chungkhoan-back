import { loginAdmin, refreshAccessToken } from "../services/authService.js";

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }

  try {
    const result = await loginAdmin(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    const result = refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
}


// Endpoint protected — verifyToken đã gắn payload access token vào req.admin.
// Trả thẳng payload (không chạm DB) để xác thực phiên còn hiệu lực; 401 ở đây
// chính là tín hiệu kích hoạt refresh ở frontend.
export function me(req, res) {
  res.json({ admin: req.admin });
}
