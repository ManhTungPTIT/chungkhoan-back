import { Router } from "express";
import {
  register,
  login,
  me,
  stats,
  pending,
  approve,
  reject,
  list,
  lock,
  unlock,
  remove,
  setPackage,
  changePass,
  packageRequest,
  packageRequestsPending,
  approvePackage,
  rejectPackage,
} from "../controllers/userController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me",verifyToken, me);
router.get("/stats", verifyToken, stats);
router.patch("/changePassword", verifyToken, changePass)
router.post("/packageRequest", verifyToken, packageRequest)

// Quản lý người dùng — chỉ admin
router.get("/", verifyToken, requireAdmin, list);
router.get("/pending", verifyToken, requireAdmin, pending);
// Yêu cầu gói chờ duyệt (đặt trước /:id/... — prefix tĩnh 'package-request' nên
// không đụng các route param, nhưng để nhóm cho rõ).
router.get("/package-request/pending", verifyToken, requireAdmin, packageRequestsPending);
router.patch("/package-request/:id/approve", verifyToken, requireAdmin, approvePackage);
router.patch("/package-request/:id/reject", verifyToken, requireAdmin, rejectPackage);
router.patch("/:id/approve", verifyToken, requireAdmin, approve);
router.patch("/:id/reject", verifyToken, requireAdmin, reject);
router.patch("/:id/lock", verifyToken, requireAdmin, lock);
router.patch("/:id/unlock", verifyToken, requireAdmin, unlock);
router.patch("/:id/package", verifyToken, requireAdmin, setPackage);
router.delete("/:id", verifyToken, requireAdmin, remove);

export default router;
