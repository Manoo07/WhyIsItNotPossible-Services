import { Router, type IRouter } from "express";
import * as authorApplicationController from "../controllers/author-application.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.post("/author-applications", requireAuth, authorApplicationController.submit);
router.get("/author-applications/me", requireAuth, authorApplicationController.getMine);

export default router;
