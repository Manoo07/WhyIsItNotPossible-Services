import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { RegisterBody, LoginBody } from "../lib/validation.js";
import { requireAuth, toPublicUser } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// POST /auth/register
router.post("/auth/register", async (req, res) => {
  try {
    const body = RegisterBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { username, email, password, displayName } = body.data;

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      res.status(409).json({ error: "Email already taken" });
      return;
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // First user gets owner role
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "owner" : "reader";

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, displayName, role },
    });

    req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    logger.error({ err }, "register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { email, password } = body.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    logger.error({ err }, "login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user!.id },
    });
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json(toPublicUser(user));
  } catch (err) {
    logger.error({ err }, "get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
