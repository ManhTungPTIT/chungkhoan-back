import { Router } from "express";
import {
  register,
  login,
  stats,
  pending,
  approve,
  reject,
  list,
  lock,
  unlock,
  remove,
  setPackage,
} from "../controllers/userController.js";
import { verifyToken, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/stats", verifyToken, stats);

// Quản lý người dùng — chỉ admin
router.get("/", verifyToken, requireAdmin, list);
router.get("/pending", verifyToken, requireAdmin, pending);
router.patch("/:id/approve", verifyToken, requireAdmin, approve);
router.patch("/:id/reject", verifyToken, requireAdmin, reject);
router.patch("/:id/lock", verifyToken, requireAdmin, lock);
router.patch("/:id/unlock", verifyToken, requireAdmin, unlock);
router.patch("/:id/package", verifyToken, requireAdmin, setPackage);
router.delete("/:id", verifyToken, requireAdmin, remove);

export default router;
