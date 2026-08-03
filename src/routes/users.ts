import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { UpdateProfileBody } from "../lib/validation.js";
import { requireAuth, toPublicUser } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { enrichPost } from "./posts-helpers.js";

const router: IRouter = Router();

// GET /users/me/bookmarks
router.get("/users/me/bookmarks", requireAuth, async (req, res) => {
  try {
    const userId = req.session!.user!.id;
    const bookmarkRows = await prisma.bookmark.findMany({
      where: { userId },
    });

    const posts = await Promise.all(
      bookmarkRows.map(async ({ postId }) => {
        const post = await prisma.post.findUnique({ where: { id: postId } });
        return post ? enrichPost(post, userId) : null;
      }),
    );
    res.json(posts.filter(Boolean));
  } catch (err) {
    logger.error({ err }, "get bookmarks error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/me/posts
router.get("/users/me/posts", requireAuth, async (req, res) => {
  try {
    const userId = req.session!.user!.id;
    const posts = await prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
    });
    const enriched = await Promise.all(posts.map((p) => enrichPost(p, userId)));
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "get my posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /users/me
router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const userId = req.session!.user!.id;
    const body = UpdateProfileBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: body.data,
    });
    res.json(toPublicUser(updated));
  } catch (err) {
    logger.error({ err }, "update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:username
router.get("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const postCount = await prisma.post.count({
      where: { authorId: user.id, status: "published" },
    });

    const viewsAgg = await prisma.post.aggregate({
      _sum: { viewCount: true },
      where: { authorId: user.id },
    });

    const totalLikes = await prisma.like.count({
      where: { post: { authorId: user.id } },
    });

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      postCount,
      totalViews: viewsAgg._sum.viewCount ?? 0,
      totalLikes,
    });
  } catch (err) {
    logger.error({ err }, "get user profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
