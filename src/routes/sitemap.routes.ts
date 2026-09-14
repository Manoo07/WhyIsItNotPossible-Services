import { Router, type IRouter } from "express";
import { getSitemap } from "../controllers/sitemap.controller.js";

const router: IRouter = Router();

router.get("/sitemap.xml", getSitemap);

export default router;
