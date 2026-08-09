import type { Prisma, PostStatus } from "@prisma/client";
import * as postDao from "../dao/post.dao.js";
import * as userDao from "../dao/user.dao.js";
import * as categoryDao from "../dao/category.dao.js";
import * as tagDao from "../dao/tag.dao.js";
import * as likeDao from "../dao/like.dao.js";
import * as commentDao from "../dao/comment.dao.js";
import * as reportDao from "../dao/report.dao.js";
import * as auditService from "./audit.service.js";
import { NotFoundError, BadRequestError } from "../lib/errors.js";

export interface ListAdminPostsInput {
  page: number;
  limit: number;
  search: string;
  status: string;
  removed: string;
  authorId: number | null;
}

async function enrichAdminPost(post: Awaited<ReturnType<typeof postDao.findById>>) {
  if (!post) return null;
  const [author, reportsCount] = await Promise.all([
    userDao.findById(post.authorId),
    reportDao.count({ targetType: "post", targetId: post.id }),
  ]);
  const { passwordHash: _ph, ...safeAuthor } = author ?? {};
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    removedAt: post.removedAt?.toISOString() ?? null,
    author: author ? safeAuthor : undefined,
    reportsCount,
  };
}

export async function listPosts(params: ListAdminPostsInput) {
  const { page, limit, search, status, removed, authorId } = params;
  const conditions: Prisma.PostWhereInput[] = [];

  if (search) {
    conditions.push({ title: { contains: search, mode: "insensitive" } });
  }
  if (status) {
    conditions.push({ status: status as PostStatus });
  }
  if (removed === "true") {
    conditions.push({ removedAt: { not: null } });
  } else if (removed === "false") {
    conditions.push({ removedAt: null });
  }
  if (authorId) {
    conditions.push({ authorId });
  }

  const where: Prisma.PostWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [posts, total] = await Promise.all([
    postDao.findMany(where, { createdAt: "desc" }, { skip: (page - 1) * limit, take: limit }),
    postDao.count(where),
  ]);

  const enriched = await Promise.all(posts.map((p) => enrichAdminPost(p)));

  return { posts: enriched, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

// Reports and moderation history are NOT bundled inline (both were
// previously unbounded findMany() calls) — see listPostReports /
// listPostModerationHistory below, fetched as their own paginated
// sub-resources the same way the top-level Posts list is.
export async function getPostDetail(id: number) {
  const post = await postDao.findById(id);
  if (!post) {
    throw new NotFoundError("Post not found");
  }

  const [category, postTags, likeCount, commentCount] = await Promise.all([
    post.categoryId ? categoryDao.findById(post.categoryId) : null,
    tagDao.findPostTagsByPost(post.id),
    likeDao.countByPost(post.id),
    commentDao.countByPost(post.id),
  ]);

  const enriched = await enrichAdminPost(post);

  return {
    ...enriched,
    category,
    tags: postTags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
    likeCount,
    commentCount,
  };
}

export async function listPostReports(postId: number, page: number, limit: number) {
  const [reports, total] = await Promise.all([
    reportDao.findByTarget("post", postId, { skip: (page - 1) * limit, take: limit }),
    reportDao.countByTarget("post", postId),
  ]);
  return { reports, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function listPostModerationHistory(postId: number, page: number, limit: number) {
  return auditService.listForTarget("post", postId, page, limit);
}

export interface RemovePostInput {
  reason: string;
  note?: string | null;
}

export async function removePost(adminId: number, postId: number, input: RemovePostInput) {
  const post = await postDao.findById(postId);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required to remove a post");
  }
  if (post.removedAt) {
    // Idempotent — matches FRS §21's "already in this state" handling for
    // moderation actions.
    return enrichAdminPost(post);
  }

  const updated = await postDao.update(postId, { removedAt: new Date(), removalReason: input.reason });

  await auditService.recordAction({
    adminId,
    action: "REMOVE_POST",
    targetType: "post",
    targetId: postId,
    reason: input.reason,
    note: input.note,
  });

  return enrichAdminPost(updated);
}

export interface RestorePostInput {
  reason: string;
  note?: string | null;
}

export async function restorePost(adminId: number, postId: number, input: RestorePostInput) {
  const post = await postDao.findById(postId);
  if (!post) {
    throw new NotFoundError("Post not found");
  }
  if (!input.reason || !input.reason.trim()) {
    throw new BadRequestError("A reason is required to restore a post");
  }
  if (!post.removedAt) {
    return enrichAdminPost(post);
  }

  const updated = await postDao.update(postId, { removedAt: null, removalReason: null });

  await auditService.recordAction({
    adminId,
    action: "RESTORE_POST",
    targetType: "post",
    targetId: postId,
    reason: input.reason,
    note: input.note,
  });

  return enrichAdminPost(updated);
}
