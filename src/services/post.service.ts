import type { Post, Prisma } from "@prisma/client";
import type { z } from "zod";
import * as cheerio from "cheerio";
import * as postDao from "../dao/post.dao.js";
import * as categoryDao from "../dao/category.dao.js";
import * as tagDao from "../dao/tag.dao.js";
import * as likeDao from "../dao/like.dao.js";
import * as bookmarkDao from "../dao/bookmark.dao.js";
import * as commentDao from "../dao/comment.dao.js";
import * as userDao from "../dao/user.dao.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../lib/errors.js";
import { slugify, estimateReadingTime } from "../lib/slugify.js";
import { sanitizeHtml, stripHtml } from "../lib/sanitize.js";
import type { CreatePostBody, UpdatePostBody, AutosavePostBody, CreateCommentBody } from "../lib/validation.js";

type CreatePostInput = z.infer<typeof CreatePostBody>;
type UpdatePostInput = z.infer<typeof UpdatePostBody>;
type AutosavePostInput = z.infer<typeof AutosavePostBody>;
type CreateCommentInput = z.infer<typeof CreateCommentBody>;
type CurrentUser = { id: number; role: string };

export async function enrichPost(post: Post, userId?: number) {
  const author = await userDao.findById(post.authorId);
  const category = post.categoryId ? await categoryDao.findById(post.categoryId) : null;

  const postTags = await tagDao.findPostTagsByPost(post.id);
  const tagRows = postTags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug }));

  const [likeCount, commentCount] = await Promise.all([
    likeDao.countByPost(post.id),
    commentDao.countByPost(post.id),
  ]);

  let isLiked = false;
  let isBookmarked = false;
  if (userId) {
    const [liked, bookmarked] = await Promise.all([
      likeDao.find(post.id, userId),
      bookmarkDao.find(post.id, userId),
    ]);
    isLiked = !!liked;
    isBookmarked = !!bookmarked;
  }

  const { passwordHash: _ph, ...safeAuthor } = author ?? {};

  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    author: author ? safeAuthor : undefined,
    category: category ? { ...category, postCount: 0 } : null,
    tags: tagRows,
    likeCount,
    commentCount,
    isLiked,
    isBookmarked,
  };
}

function assertPublishable(data: { title: string; subtitle?: string | null; content: string; tags: string[] }) {
  if (data.title.length > 150) {
    throw new BadRequestError("Title must be 150 characters or fewer");
  }
  if (data.subtitle && data.subtitle.length > 250) {
    throw new BadRequestError("Subtitle must be 250 characters or fewer");
  }

  const plainText = stripHtml(data.content).trim();
  if (plainText.length < 100) {
    throw new BadRequestError("Content must be at least 100 characters, excluding formatting");
  }

  const $ = cheerio.load(data.content);

  const hasParagraph = $("p")
    .toArray()
    .some((el) => $(el).text().trim().length > 0);
  if (!hasParagraph) {
    throw new BadRequestError("Content must include at least one paragraph");
  }

  const hasMissingAlt = $("img")
    .toArray()
    .some((el) => !($(el).attr("alt") ?? "").trim());
  if (hasMissingAlt) {
    throw new BadRequestError("Every image needs alt text before publishing");
  }

  if (data.tags.length === 0) {
    throw new BadRequestError("At least one tag is required to publish");
  }
  if (data.tags.length > 5) {
    throw new BadRequestError("Up to 5 tags allowed");
  }
}

async function syncPostTags(postId: number, tags: string[]) {
  for (const tagName of tags) {
    const tagSlug = slugify(tagName);
    let tag = await tagDao.findBySlug(tagSlug);
    if (!tag) {
      tag = await tagDao.create({ name: tagName.trim(), slug: tagSlug });
    }
    await tagDao.upsertPostTag(postId, tag.id);
  }
}

export interface ListPostsInput {
  page: number;
  limit: number;
  search: string;
  categorySlug: string;
  tagSlug: string;
  status: string;
  authorId: number | null;
  sort: string;
  userId?: number;
}

export async function list(params: ListPostsInput) {
  const { page, limit, search, categorySlug, tagSlug, status, authorId, sort, userId } = params;
  const offset = (page - 1) * limit;
  const conditions: Prisma.PostWhereInput[] = [];

  // Non-owners only see published posts unless they're the author
  if (status !== "draft" || userId === undefined) {
    conditions.push({ status: "published" });
  } else if (status === "draft" && userId !== undefined) {
    conditions.push({ authorId: userId });
  }

  if (search) {
    conditions.push({ title: { contains: search, mode: "insensitive" } });
  }

  if (authorId) {
    conditions.push({ authorId });
  }

  if (categorySlug) {
    const cat = await categoryDao.findBySlug(categorySlug);
    if (cat) {
      conditions.push({ categoryId: cat.id });
    }
  }

  const where: Prisma.PostWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "popular" || sort === "trending"
      ? { viewCount: "desc" }
      : sort === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

  let posts = await postDao.findMany(where, orderBy);

  // Filter by tag after query (simple approach)
  if (tagSlug) {
    const tag = await tagDao.findBySlug(tagSlug);
    if (tag) {
      const postTagRows = await tagDao.findPostTagsByTag(tag.id);
      const postIds = new Set(postTagRows.map((r) => r.postId));
      posts = posts.filter((p) => postIds.has(p.id));
    }
  }

  const total = posts.length;
  const paginated = posts.slice(offset, offset + limit);
  const enriched = await Promise.all(paginated.map((p) => enrichPost(p, userId)));

  return {
    posts: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getFeatured(limit: number, userId?: number) {
  const posts = await postDao.findMany({ status: "published", featured: true }, { publishedAt: "desc" }, limit);

  // Fall back to latest published if no featured
  const effectivePosts =
    posts.length > 0 ? posts : await postDao.findMany({ status: "published" }, { publishedAt: "desc" }, limit);

  return Promise.all(effectivePosts.map((p) => enrichPost(p, userId)));
}

export async function getTrending(limit: number, userId?: number) {
  const posts = await postDao.findMany({ status: "published" }, { viewCount: "desc" }, limit);
  return Promise.all(posts.map((p) => enrichPost(p, userId)));
}

export async function getStats() {
  const [totalPosts, viewsAgg, totalLikes, totalAuthors, categories] = await Promise.all([
    postDao.count({ status: "published" }),
    postDao.sumViewCount({ status: "published" }),
    likeDao.countAll(),
    userDao.count({ role: { in: ["owner", "author"] } }),
    categoryDao.findMany(),
  ]);

  const categoryBreakdown = await Promise.all(
    categories.map(async (c) => {
      const count = await postDao.count({ categoryId: c.id, status: "published" });
      return { name: c.name, slug: c.slug, count };
    }),
  );

  return {
    totalPosts,
    totalViews: viewsAgg._sum.viewCount ?? 0,
    totalLikes,
    totalAuthors,
    categoryBreakdown,
  };
}

export async function getById(id: number, userId?: number) {
  const post = await postDao.findById(id);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  return enrichPost(post, userId);
}

export async function getBySlug(slug: string, userId?: number) {
  const post = await postDao.findBySlug(slug);
  if (!post) {
    throw new NotFoundError("Post not found");
  }

  // Increment view count
  const updated = await postDao.update(post.id, { viewCount: post.viewCount + 1 });

  return enrichPost(updated, userId);
}

export async function create(authorId: number, data: CreatePostInput) {
  const { title, subtitle, content: rawContent, excerpt, coverImageUrl, status, featured, categoryId, tags } = data;
  const content = sanitizeHtml(rawContent);

  if (status === "published") {
    assertPublishable({ title, subtitle, content, tags: tags ?? [] });
  }

  let slug = slugify(title);
  // Ensure slug uniqueness
  const existing = await postDao.findBySlug(slug);
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const readingTime = estimateReadingTime(content);

  const post = await postDao.create({
    title,
    subtitle,
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
  });

  if (tags && tags.length > 0) {
    await syncPostTags(post.id, tags);
  }

  // TODO (Phase 8): snapshot a PostRevision here.
  return enrichPost(post, authorId);
}

export async function update(id: number, currentUser: CurrentUser, data: UpdatePostInput) {
  const existing = await postDao.findById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }

  const isOwnerOrAuthor = currentUser.role === "owner" || existing.authorId === currentUser.id;
  if (!isOwnerOrAuthor) {
    throw new ForbiddenError();
  }

  const { tags, ...updateData } = data;

  const sanitizedContent = updateData.content !== undefined ? sanitizeHtml(updateData.content) : undefined;
  const effectiveStatus = updateData.status ?? existing.status;

  if (effectiveStatus === "published") {
    const effectiveTags =
      tags !== undefined ? tags : (await tagDao.findPostTagsByPost(id)).map((pt) => pt.tag.name);
    assertPublishable({
      title: updateData.title ?? existing.title,
      subtitle: updateData.subtitle !== undefined ? updateData.subtitle : existing.subtitle,
      content: sanitizedContent ?? existing.content,
      tags: effectiveTags,
    });
  }

  const updates: Prisma.PostUpdateInput = { ...updateData, updatedAt: new Date() };
  if (sanitizedContent !== undefined) {
    updates.content = sanitizedContent;
    updates.readingTime = estimateReadingTime(sanitizedContent);
  }
  if (updateData.status === "published" && existing.status !== "published") {
    updates.publishedAt = new Date();
  }

  const updated = await postDao.update(id, updates);

  // Update tags if provided
  if (tags !== undefined) {
    await tagDao.deletePostTagsByPost(id);
    await syncPostTags(id, tags);
  }

  // TODO (Phase 8): snapshot a PostRevision here.
  return enrichPost(updated, currentUser.id);
}

export async function autosave(id: number, currentUser: CurrentUser, data: AutosavePostInput) {
  const existing = await postDao.findById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }

  const isOwnerOrAuthor = currentUser.role === "owner" || existing.authorId === currentUser.id;
  if (!isOwnerOrAuthor) {
    throw new ForbiddenError();
  }

  const { tags, ...updateData } = data;

  const updates: Prisma.PostUpdateInput = { ...updateData, updatedAt: new Date() };
  if (updateData.content !== undefined) {
    updates.content = sanitizeHtml(updateData.content);
    updates.readingTime = estimateReadingTime(updates.content);
  }

  const updated = await postDao.update(id, updates);

  if (tags !== undefined) {
    await tagDao.deletePostTagsByPost(id);
    await syncPostTags(id, tags);
  }

  return enrichPost(updated, currentUser.id);
}

export async function remove(id: number, currentUser: CurrentUser) {
  const existing = await postDao.findById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }
  const isOwnerOrAuthor = currentUser.role === "owner" || existing.authorId === currentUser.id;
  if (!isOwnerOrAuthor) {
    throw new ForbiddenError();
  }
  await postDao.remove(id);
}

export async function toggleLike(postId: number, userId: number) {
  const existing = await likeDao.find(postId, userId);

  if (existing) {
    await likeDao.remove(postId, userId);
  } else {
    await likeDao.create(postId, userId);
  }

  const likeCount = await likeDao.countByPost(postId);

  return { liked: !existing, likeCount };
}

export async function toggleBookmark(postId: number, userId: number) {
  const existing = await bookmarkDao.find(postId, userId);

  if (existing) {
    await bookmarkDao.remove(postId, userId);
  } else {
    await bookmarkDao.create(postId, userId);
  }

  return { bookmarked: !existing };
}

// Ranks candidate posts by how many tags they share with the source post
// (the strongest signal — two posts about the same specific things) plus a
// same-category bonus and a small popularity tiebreaker, rather than just
// "same category, most viewed" — a post could be in a different category
// entirely and still be the more relevant read if it shares three tags.
const RELATED_TAG_WEIGHT = 3;
const RELATED_CATEGORY_WEIGHT = 2;

// Scores every other published post rather than pre-filtering to a small
// candidate pool — the pool is small enough (a personal blog, not a
// platform-scale catalog) that this is cheap, and it means "View More"
// pagination can page all the way through the entire catalog, ranked most-
// to least relevant, instead of running out after one small pre-filtered
// batch.
export async function getRelated(id: number, page: number, pageSize: number, userId?: number) {
  const post = await postDao.findById(id);
  if (!post) {
    return { posts: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const ownTags = await tagDao.findPostTagsByPost(id);
  const ownTagIds = ownTags.map((pt) => pt.tagId);

  const sharedTagCounts = new Map<number, number>();
  if (ownTagIds.length > 0) {
    const rows = await tagDao.findPostTagsForTagIds(ownTagIds, id);
    for (const { postId } of rows) {
      sharedTagCounts.set(postId, (sharedTagCounts.get(postId) ?? 0) + 1);
    }
  }

  const allOthers = await postDao.findMany({ status: "published", id: { not: id } }, { viewCount: "desc" });

  const ranked = allOthers
    .map((p) => {
      const tagScore = (sharedTagCounts.get(p.id) ?? 0) * RELATED_TAG_WEIGHT;
      const categoryScore = post.categoryId && p.categoryId === post.categoryId ? RELATED_CATEGORY_WEIGHT : 0;
      const popularityScore = Math.log10(p.viewCount + 1) * 0.5;
      return { post: p, score: tagScore + categoryScore + popularityScore };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.post);

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSlice = ranked.slice((page - 1) * pageSize, page * pageSize);

  return {
    posts: await Promise.all(pageSlice.map((p) => enrichPost(p, userId))),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function listComments(postId: number) {
  const comments = await commentDao.findManyByPost(postId);

  return Promise.all(
    comments.map(async (c) => {
      const author = await userDao.findById(c.userId);
      const { passwordHash: _ph, ...safeAuthor } = author ?? {};
      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        author: author ? safeAuthor : undefined,
      };
    }),
  );
}

export async function addComment(postId: number, userId: number, data: CreateCommentInput) {
  const comment = await commentDao.create({
    postId,
    userId,
    content: data.content,
    parentId: data.parentId ?? null,
  });

  const author = await userDao.findById(userId);
  const { passwordHash: _ph, ...safeAuthor } = author ?? {};

  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    author: author ? safeAuthor : undefined,
  };
}

export async function removeComment(id: number, currentUser: CurrentUser) {
  const comment = await commentDao.findById(id);
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }
  const isOwner = comment.userId === currentUser.id || currentUser.role === "owner";
  if (!isOwner) {
    throw new ForbiddenError();
  }
  await commentDao.remove(id);
}
