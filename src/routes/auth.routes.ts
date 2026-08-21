import { Router, type IRouter } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authLimiter, otpLimiter } from "../middleware/rate-limit.middleware.js";

const router: IRouter = Router();

router.post("/auth/register", authLimiter, authController.register);
router.post("/auth/login", authLimiter, authController.login);
router.post("/auth/logout", authController.logout);
router.get("/auth/me", requireAuth, authController.me);

router.post("/auth/verify-email", otpLimiter, authController.verifyEmail);
router.post("/auth/resend-otp", otpLimiter, authController.resendOtp);
router.post("/auth/forgot-password", otpLimiter, authController.forgotPassword);
router.post("/auth/reset-password", otpLimiter, authController.resetPassword);

export default router;
