import { Router, type IRouter } from "express";
import * as categoryController from "../controllers/category.controller.js";
import { requireRole } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

router.get("/categories", categoryController.list);
router.post("/categories", requireRole("owner"), categoryController.create);
router.patch("/categories/:id", requireRole("owner"), categoryController.update);
router.delete("/categories/:id", requireRole("owner"), categoryController.remove);

export default router;
