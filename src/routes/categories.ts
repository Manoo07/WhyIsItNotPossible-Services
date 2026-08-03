import { Router, type IRouter } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CreateCategoryBody, UpdateCategoryBody } from "../lib/validation.js";
import { requireRole } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// GET /categories
router.get("/categories", async (_req, res) => {
  try {
    const cats = await prisma.category.findMany();
    const withCount = await Promise.all(
      cats.map(async (c) => {
        const count = await prisma.post.count({ where: { categoryId: c.id } });
        return { ...c, postCount: count };
      }),
    );
    res.json(withCount);
  } catch (err) {
    logger.error({ err }, "list categories error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /categories (owner only)
router.post("/categories", requireRole("owner"), async (req, res) => {
  try {
    const body = CreateCategoryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const cat = await prisma.category.create({ data: body.data });
    res.status(201).json({ ...cat, postCount: 0 });
  } catch (err) {
    logger.error({ err }, "create category error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /categories/:id
router.patch("/categories/:id", requireRole("owner"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateCategoryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    let cat;
    try {
      cat = await prisma.category.update({ where: { id }, data: body.data });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      throw e;
    }

    res.json({ ...cat, postCount: 0 });
  } catch (err) {
    logger.error({ err }, "update category error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /categories/:id
router.delete("/categories/:id", requireRole("owner"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.category.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete category error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
