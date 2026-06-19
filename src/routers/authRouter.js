import { Router } from "express";
import { login, refresh, logout, me } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", verifyToken, me);

export default router;
