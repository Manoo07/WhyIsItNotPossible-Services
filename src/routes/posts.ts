import { Router, type IRouter } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  CreatePostBody,
  UpdatePostBody,
  CreateCommentBody,
} from "../lib/validation.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { slugify, estimateReadingTime } from "../lib/slugify.js";
import { logger } from "../lib/logger.js";
import { enrichPost } from "./posts-helpers.js";

const router: IRouter = Router();

// GET /posts
router.get("/posts", async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = Math.min(parseInt(String(req.query.limit ?? "12")), 50);
    const offset = (page - 1) * limit;
    const search = String(req.query.search ?? "");
    const categorySlug = String(req.query.category ?? "");
    const tagSlug = String(req.query.tag ?? "");
    const status = String(req.query.status ?? "published");
    const authorIdParam = req.query.authorId
      ? parseInt(String(req.query.authorId))
      : null;
    const sort = String(req.query.sort ?? "newest");
    const userId = req.session?.user?.id;

    const conditions: Prisma.PostWhereInput[] = [];

    // Non-owners only see published posts unless they're the author
    if (status !== "draft" || !req.session?.user) {
      conditions.push({ status: "published" });
    } else if (status === "draft" && req.session?.user) {
      conditions.push({ authorId: req.session.user.id });
    }

    if (search) {
      conditions.push({ title: { contains: search, mode: "insensitive" } });
    }

    if (authorIdParam) {
      conditions.push({ authorId: authorIdParam });
    }

    if (categorySlug) {
      const cat = await prisma.category.findUnique({
        where: { slug: categorySlug },
      });
      if (cat) {
        conditions.push({ categoryId: cat.id });
      }
    }

    const where: Prisma.PostWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    // Sort
    const orderBy: Prisma.PostOrderByWithRelationInput =
      sort === "popular" || sort === "trending"
        ? { viewCount: "desc" }
        : sort === "oldest"
          ? { createdAt: "asc" }
          : { createdAt: "desc" };

    let posts = await prisma.post.findMany({ where, orderBy });

    // Filter by tag after query (simple approach)
    if (tagSlug) {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (tag) {
        const postTagRows = await prisma.postTag.findMany({
          where: { tagId: tag.id },
        });
        const postIds = new Set(postTagRows.map((r) => r.postId));
        posts = posts.filter((p) => postIds.has(p.id));
      }
    }

    const total = posts.length;
    const paginated = posts.slice(offset, offset + limit);

    const enriched = await Promise.all(
      paginated.map((p) => enrichPost(p, userId)),
    );

    res.json({
      posts: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error({ err }, "list posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/featured
router.get("/posts/featured", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "5")), 10);
    const userId = req.session?.user?.id;
    const posts = await prisma.post.findMany({
      where: { status: "published", featured: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    // Fall back to latest published if no featured
    const effectivePosts =
      posts.length > 0
        ? posts
        : await prisma.post.findMany({
            where: { status: "published" },
            orderBy: { publishedAt: "desc" },
            take: limit,
          });

    const enriched = await Promise.all(
      effectivePosts.map((p) => enrichPost(p, userId)),
    );
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "featured posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/trending
router.get("/posts/trending", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "6")), 12);
    const userId = req.session?.user?.id;
    const posts = await prisma.post.findMany({
      where: { status: "published" },
      orderBy: { viewCount: "desc" },
      take: limit,
    });
    const enriched = await Promise.all(posts.map((p) => enrichPost(p, userId)));
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "trending posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/stats
router.get("/posts/stats", async (_req, res) => {
  try {
    const [totalPosts, viewsAgg, totalLikes, totalAuthors, categories] =
      await Promise.all([
        prisma.post.count({ where: { status: "published" } }),
        prisma.post.aggregate({
          _sum: { viewCount: true },
          where: { status: "published" },
        }),
        prisma.like.count(),
        prisma.user.count({ where: { role: { in: ["owner", "author"] } } }),
        prisma.category.findMany(),
      ]);

    const categoryBreakdown = await Promise.all(
      categories.map(async (c) => {
        const count = await prisma.post.count({
          where: { categoryId: c.id, status: "published" },
        });
        return { name: c.name, slug: c.slug, count };
      }),
    );

    res.json({
      totalPosts,
      totalViews: viewsAgg._sum.viewCount ?? 0,
      totalLikes,
      totalAuthors,
      categoryBreakdown,
    });
  } catch (err) {
    logger.error({ err }, "blog stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/:id
router.get("/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const userId = req.session?.user?.id;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const enriched = await enrichPost(post, userId);
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "get post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/slug/:slug
router.get("/posts/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.session?.user?.id;
    const post = await prisma.post.findUnique({ where: { slug } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    // Increment view count
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: post.viewCount + 1 },
    });

    const enriched = await enrichPost(updated, userId);
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "get post by slug error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /posts
router.post("/posts", requireRole("owner", "author"), async (req, res) => {
  try {
    const body = CreatePostBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { title, content, excerpt, coverImageUrl, status, featured, categoryId, tags } = body.data;

    let slug = slugify(title);
    // Ensure slug uniqueness
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const readingTime = estimateReadingTime(content);
    const authorId = req.session.user!.id;

    const post = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        coverImageUrl,
        status: status ?? "draft",
        featured: featured ?? false,
        authorId,
        categoryId: categoryId ?? null,
        readingTime,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    // Handle tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const tagSlug = slugify(tagName);
        let tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        if (!tag) {
          tag = await prisma.tag.create({
            data: { name: tagName.trim(), slug: tagSlug },
          });
        }
        await prisma.postTag.upsert({
          where: { postId_tagId: { postId: post.id, tagId: tag.id } },
          create: { postId: post.id, tagId: tag.id },
          update: {},
        });
      }
    }

    const enriched = await enrichPost(post, authorId);
    res.status(201).json(enriched);
  } catch (err) {
    logger.error({ err }, "create post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /posts/:id
router.patch("/posts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.session!.user!.id;

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const isOwnerOrAuthor = req.session!.user!.role === "owner" || existing.authorId === userId;
    if (!isOwnerOrAuthor) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }

    const body = UpdatePostBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { tags, ...updateData } = body.data;

    const updates: Prisma.PostUpdateInput = { ...updateData, updatedAt: new Date() };
    if (updateData.content) {
      updates.readingTime = estimateReadingTime(updateData.content);
    }
    if (updateData.status === "published" && existing.status !== "published") {
      updates.publishedAt = new Date();
    }

    const updated = await prisma.post.update({ where: { id }, data: updates });

    // Update tags if provided
    if (tags !== undefined) {
      await prisma.postTag.deleteMany({ where: { postId: id } });
      for (const tagName of tags) {
        const tagSlug = slugify(tagName);
        let tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
        if (!tag) {
          tag = await prisma.tag.create({
            data: { name: tagName.trim(), slug: tagSlug },
          });
        }
        await prisma.postTag.upsert({
          where: { postId_tagId: { postId: id, tagId: tag.id } },
          create: { postId: id, tagId: tag.id },
          update: {},
        });
      }
    }

    const enriched = await enrichPost(updated, userId);
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "update post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /posts/:id
router.delete("/posts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const isOwnerOrAuthor =
      req.session!.user!.role === "owner" ||
      existing.authorId === req.session!.user!.id;
    if (!isOwnerOrAuthor) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }
    await prisma.post.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /posts/:id/like
router.post("/posts/:id/like", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.session!.user!.id;

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.like.delete({
        where: { postId_userId: { postId, userId } },
      });
    } else {
      await prisma.like.create({ data: { postId, userId } });
    }

    const likeCount = await prisma.like.count({ where: { postId } });

    res.json({ liked: !existing, likeCount });
  } catch (err) {
    logger.error({ err }, "like post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /posts/:id/bookmark
router.post("/posts/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.session!.user!.id;

    const existing = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.bookmark.delete({
        where: { postId_userId: { postId, userId } },
      });
    } else {
      await prisma.bookmark.create({ data: { postId, userId } });
    }

    res.json({ bookmarked: !existing });
  } catch (err) {
    logger.error({ err }, "bookmark post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/:id/related
router.get("/posts/:id/related", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const limit = Math.min(parseInt(String(req.query.limit ?? "4")), 8);
    const userId = req.session?.user?.id;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      res.json([]);
      return;
    }

    const related = await prisma.post.findMany({
      where: {
        AND: [
          { status: "published" },
          post.categoryId ? { categoryId: post.categoryId } : {},
          { id: { not: id } },
        ],
      },
      orderBy: { viewCount: "desc" },
      take: limit,
    });

    // Fall back to latest posts if not enough
    if (related.length < limit) {
      const fallback = await prisma.post.findMany({
        where: {
          AND: [{ status: "published" }, { id: { not: id } }],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      const existingIds = new Set(related.map((p) => p.id));
      for (const p of fallback) {
        if (!existingIds.has(p.id)) {
          related.push(p);
          if (related.length >= limit) break;
        }
      }
    }

    const enriched = await Promise.all(
      related.slice(0, limit).map((p) => enrichPost(p, userId)),
    );
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "related posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /posts/:id/comments
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });

    const enriched = await Promise.all(
      comments.map(async (c) => {
        const author = await prisma.user.findUnique({
          where: { id: c.userId },
        });
        const { passwordHash: _ph, ...safeAuthor } = author ?? {};
        return {
          ...c,
          createdAt: c.createdAt.toISOString(),
          author: author ? safeAuthor : undefined,
        };
      }),
    );
    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "list comments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /posts/:id/comments
router.post("/posts/:id/comments", requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.session!.user!.id;
    const body = CreateCommentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content: body.data.content,
        parentId: body.data.parentId ?? null,
      },
    });

    const author = await prisma.user.findUnique({ where: { id: userId } });
    const { passwordHash: _ph, ...safeAuthor } = author ?? {};

    res.status(201).json({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      author: author ? safeAuthor : undefined,
    });
  } catch (err) {
    logger.error({ err }, "create comment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /comments/:id
router.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    const isOwner =
      comment.userId === req.session!.user!.id ||
      req.session!.user!.role === "owner";
    if (!isOwner) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }
    await prisma.comment.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "delete comment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
