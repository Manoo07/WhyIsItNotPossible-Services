import { Router, type IRouter } from "express";
import * as reportController from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { reportLimiter } from "../middleware/rate-limit.middleware.js";

const router: IRouter = Router();

// Consumer-facing — any authenticated user can file a report. The
// corresponding admin review surface lives under /admin/reports
// (admin.routes.ts), gated separately by requireAdmin.
router.post("/reports", requireAuth, reportLimiter, reportController.submit);

export default router;
