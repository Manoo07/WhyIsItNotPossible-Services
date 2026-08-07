import { Router, type IRouter } from "express";
import { getHealth } from "../controllers/health.controller.js";

const router: IRouter = Router();

router.get("/healthz", getHealth);

export default router;
