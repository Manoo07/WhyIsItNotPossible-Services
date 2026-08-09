import { Router, type IRouter } from "express";
import * as adminDashboardController from "../controllers/admin-dashboard.controller.js";
import * as adminUserController from "../controllers/admin-user.controller.js";
import * as adminPostController from "../controllers/admin-post.controller.js";
import * as reportController from "../controllers/report.controller.js";
import * as auditController from "../controllers/audit.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// Every route below requires the Super Admin role (this app's "owner" role
// — see requireAdmin). Hiding buttons in the frontend is not authorization;
// this is the actual enforcement point (FRS §22).
router.use("/admin", requireAdmin);

router.get("/admin/dashboard", adminDashboardController.get);

router.get("/admin/users", adminUserController.list);
router.get("/admin/users/:id", adminUserController.detail);
router.get("/admin/users/:id/moderation-history", adminUserController.listModerationHistory);
router.patch("/admin/users/:id/status", adminUserController.updateStatus);
router.patch("/admin/users/:id/role", adminUserController.updateRole);
router.post("/admin/users/:id/force-logout", adminUserController.forceLogout);

router.get("/admin/posts", adminPostController.list);
router.get("/admin/posts/:id", adminPostController.detail);
router.get("/admin/posts/:id/reports", adminPostController.listReports);
router.get("/admin/posts/:id/moderation-history", adminPostController.listModerationHistory);
router.patch("/admin/posts/:id/status", adminPostController.updateStatus);

router.get("/admin/reports", reportController.list);
router.get("/admin/reports/:id", reportController.detail);
router.get("/admin/reports/:id/related", reportController.listRelated);
router.get("/admin/reports/:id/moderation-history", reportController.listModerationHistory);
router.patch("/admin/reports/:id", reportController.decide);

router.get("/admin/audit-logs", auditController.list);

export default router;
