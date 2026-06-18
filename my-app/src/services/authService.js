import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/adminModel.js";
import { signTokens } from "../untils/tokenUtils.js";

export async function loginAdmin(username, password) {
  const admin = await Admin.findOne({ username });
  if (!admin) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) throw new Error("Invalid credentials");

  const { accessToken, refreshToken } = signTokens({
    id: admin._id,
    username: admin.username,
    role: admin.role,
  });

  return { accessToken, refreshToken, admin: { id: admin._id, username: admin.username, role: admin.role } };
}

export function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new Error("Invalid or expired refresh token");
  }

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const accessToken = jwt.sign(
    { id: payload.id, username: payload.username, role: payload.role, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" }
  );

  return { accessToken };
}
