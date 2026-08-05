import { Router } from "express";
import {
  login,
  refresh,
  logout,
  me,
  sessionStatus,
} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", verifyToken, me);
// Heartbeat phiên — FE poll nhịp ~12s, xem authController.sessionStatus.
router.get("/session", verifyToken, sessionStatus);

export default router;
