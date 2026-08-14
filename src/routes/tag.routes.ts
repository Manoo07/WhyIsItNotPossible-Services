import { Router, type IRouter } from "express";
import * as tagController from "../controllers/tag.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.get("/tags", tagController.list);
router.post("/tags", requireRole("owner"), tagController.create);
router.patch("/tags/:id", requireRole("owner"), tagController.update);
router.delete("/tags/:id", requireRole("owner"), tagController.remove);

export default router;
