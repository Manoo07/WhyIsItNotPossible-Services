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
import { NotFoundError, ForbiddenError, BadRequestError, RateLimitError } from "../lib/errors.js";
import { slugify, estimateReadingTime } from "../lib/slugify.js";
import { sanitizeHtml, stripHtml } from "../lib/sanitize.js";
import { logger } from "../lib/logger.js";
import { isOwnerOrAuthorOf } from "../lib/policy.js";
import { enqueuePostPublished } from "../queues/notification.queue.js";
import type { CreatePostBody, UpdatePostBody, AutosavePostBody } from "../lib/validation.js";

type CreatePostInput = z.infer<typeof CreatePostBody>;
type UpdatePostInput = z.infer<typeof UpdatePostBody>;
type AutosavePostInput = z.infer<typeof AutosavePostBody>;
type CurrentUser = { id: number; role: string };

// Cost controls for a service where every image lives in S3 and every
// request is billed — see docs/admin-console-architecture-notes.md for the
// "verified by admin before posting" gate these pair with (role itself is
// the verification state; owners are exempt from both limits below since
// they're the trusted operator, not a rate-limited public author).
const MAX_IMAGES_PER_POST = 10;
const DAILY_POST_LIMIT = 10;

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

  const images = $("img").toArray();

  const hasMissingAlt = images.some((el) => !($(el).attr("alt") ?? "").trim());
  if (hasMissingAlt) {
    throw new BadRequestError("Every image needs alt text before publishing");
  }

  if (images.length > MAX_IMAGES_PER_POST) {
    throw new BadRequestError(`Up to ${MAX_IMAGES_PER_POST} images allowed per post (cover image not included)`);
  }

  if (data.tags.length === 0) {
    throw new BadRequestError("At least one tag is required to publish");
  }
  if (data.tags.length > 5) {
    throw new BadRequestError("Up to 5 tags allowed");
  }
}

// Enqueues the follower-notification fanout job. Fire-and-forget from the
// caller's perspective: a queue/Redis outage must not break post
// publication (FRS section 21), so this only logs on failure.
async function notifyFollowersOfPublish(postId: number) {
  try {
    await enqueuePostPublished(postId);
  } catch (err) {
    logger.error({ postId, err }, "Failed to enqueue post-published notification fanout");
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
  const conditions: Prisma.PostWhereInput[] = [];

  // Removed by moderation — never visible on the consumer-facing list,
  // independent of the draft/published filter above (a post can be
  // published and removed at the same time; see FRS §30 on keeping these
  // as separate state machines).
  conditions.push({ removedAt: null });

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

  // Pushed into the where-clause (a relation filter) rather than fetched
  // and filtered in JS after the fact — that's what makes DB-level
  // skip/take below give a correct page instead of a page computed before
  // the tag filter was applied.
  if (tagSlug) {
    conditions.push({ postTags: { some: { tag: { slug: tagSlug } } } });
  }

  const where: Prisma.PostWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "popular" || sort === "trending"
      ? { viewCount: "desc" }
      : sort === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

  const [posts, total] = await Promise.all([
    postDao.findMany(where, orderBy, { skip: (page - 1) * limit, take: limit }),
    postDao.count(where),
  ]);

  const enriched = await Promise.all(posts.map((p) => enrichPost(p, userId)));

  return {
    posts: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getFeatured(limit: number, userId?: number) {
  const posts = await postDao.findMany(
    { status: "published", featured: true, removedAt: null },
    { publishedAt: "desc" },
    { take: limit },
  );

  // Fall back to latest published if no featured
  const effectivePosts =
    posts.length > 0
      ? posts
      : await postDao.findMany({ status: "published", removedAt: null }, { publishedAt: "desc" }, { take: limit });

  return Promise.all(effectivePosts.map((p) => enrichPost(p, userId)));
}

export async function getTrending(limit: number, userId?: number) {
  const posts = await postDao.findMany({ status: "published", removedAt: null }, { viewCount: "desc" }, { take: limit });
  return Promise.all(posts.map((p) => enrichPost(p, userId)));
}

export async function getById(id: number, userId?: number) {
  const post = await postDao.findById(id);
  if (!post || post.removedAt) {
    throw new NotFoundError("Post not found");
  }
  return enrichPost(post, userId);
}

export async function getBySlug(slug: string, userId?: number) {
  const post = await postDao.findBySlug(slug);
  if (!post || post.removedAt) {
    throw new NotFoundError("Post not found");
  }

  // Increment view count
  const updated = await postDao.update(post.id, { viewCount: post.viewCount + 1 });

  return enrichPost(updated, userId);
}

export async function create(currentUser: CurrentUser, data: CreatePostInput) {
  const authorId = currentUser.id;

  // Owners are the trusted operator running the site, not a rate-limited
  // public author — everyone else (verified authors) gets a daily cap so a
  // compromised or malicious account can't run up the S3 bill overnight.
  if (currentUser.role !== "owner") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const postsToday = await postDao.count({ authorId, createdAt: { gte: since } });
    if (postsToday >= DAILY_POST_LIMIT) {
      throw new RateLimitError(`You've reached your daily limit of ${DAILY_POST_LIMIT} posts. Try again tomorrow.`);
    }
  }

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

  if (post.status === "published") {
    await notifyFollowersOfPublish(post.id);
  }

  // TODO (Phase 8): snapshot a PostRevision here.
  return enrichPost(post, authorId);
}

export async function update(id: number, currentUser: CurrentUser, data: UpdatePostInput) {
  const existing = await postDao.findById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }

  const isOwnerOrAuthor = isOwnerOrAuthorOf(currentUser, existing);
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
  // The only "becomes publicly published" transition (FRS section 7) — not
  // a draft being saved, not an edit to an already-published post.
  const isNewlyPublished = updateData.status === "published" && existing.status !== "published";
  if (isNewlyPublished) {
    updates.publishedAt = new Date();
  }

  const updated = await postDao.update(id, updates);

  // Update tags if provided
  if (tags !== undefined) {
    await tagDao.deletePostTagsByPost(id);
    await syncPostTags(id, tags);
  }

  if (isNewlyPublished) {
    await notifyFollowersOfPublish(id);
  }

  // TODO (Phase 8): snapshot a PostRevision here.
  return enrichPost(updated, currentUser.id);
}

export async function autosave(id: number, currentUser: CurrentUser, data: AutosavePostInput) {
  const existing = await postDao.findById(id);
  if (!existing) {
    throw new NotFoundError("Post not found");
  }

  const isOwnerOrAuthor = isOwnerOrAuthorOf(currentUser, existing);
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
  const isOwnerOrAuthor = isOwnerOrAuthorOf(currentUser, existing);
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

