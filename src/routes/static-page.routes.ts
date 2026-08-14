import { Router, type IRouter } from "express";
import * as staticPageController from "../controllers/static-page.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.get("/static-pages", staticPageController.list);
router.get("/static-pages/:slug", staticPageController.getBySlug);
router.patch("/static-pages/:slug", requireRole("owner"), staticPageController.update);

export default router;
