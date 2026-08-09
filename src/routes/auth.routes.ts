import { Router, type IRouter } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rate-limit.middleware.js";

const router: IRouter = Router();

router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);
router.post("/auth/logout", authController.logout);
router.get("/auth/me", requireAuth, authController.me);

export default router;
