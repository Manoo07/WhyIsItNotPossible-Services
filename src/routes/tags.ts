import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// GET /tags
router.get("/tags", async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany();
    res.json(tags);
  } catch (err) {
    logger.error({ err }, "list tags error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
