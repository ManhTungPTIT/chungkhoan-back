import { Router } from "express";
import { register, login, stats } from "../controllers/userController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/stats", verifyToken, stats);

export default router;
