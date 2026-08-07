import { Router, type IRouter } from "express";
import * as tagController from "../controllers/tag.controller.js";

const router: IRouter = Router();

router.get("/tags", tagController.list);

export default router;
