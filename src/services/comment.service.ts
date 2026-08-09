import type { z } from "zod";
import * as commentDao from "../dao/comment.dao.js";
import * as userDao from "../dao/user.dao.js";
import * as auditService from "./audit.service.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../lib/errors.js";
import type { CreateCommentBody } from "../lib/validation.js";

type CreateCommentInput = z.infer<typeof CreateCommentBody>;
type CurrentUser = { id: number; role: string };

export async function listComments(postId: number, page: number, limit: number) {
  const [comments, total] = await Promise.all([
    commentDao.findManyByPost(postId, { skip: (page - 1) * limit, take: limit }),
    commentDao.countByPost(postId),
  ]);

  const enriched = await Promise.all(
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

  return { comments: enriched, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
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

// Moderation removal — soft delete, distinct from removeComment()'s hard
// delete (which is only for a user deleting their own comment). Used by
// report.service.ts's "remove_content" decision.
export async function moderationRemove(adminId: number, id: number, reason: string, note?: string | null) {
  const comment = await commentDao.findById(id);
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }
  if (!reason || !reason.trim()) {
    throw new BadRequestError("A reason is required to remove a comment");
  }
  if (comment.removedAt) {
    return comment;
  }

  const updated = await commentDao.update(id, { removedAt: new Date(), removalReason: reason });
  await auditService.recordAction({ adminId, action: "REMOVE_COMMENT", targetType: "comment", targetId: id, reason, note });
  return updated;
}

export async function moderationRestore(adminId: number, id: number, reason: string, note?: string | null) {
  const comment = await commentDao.findById(id);
  if (!comment) {
    throw new NotFoundError("Comment not found");
  }
  if (!reason || !reason.trim()) {
    throw new BadRequestError("A reason is required to restore a comment");
  }
  if (!comment.removedAt) {
    return comment;
  }

  const updated = await commentDao.update(id, { removedAt: null, removalReason: null });
  await auditService.recordAction({ adminId, action: "RESTORE_COMMENT", targetType: "comment", targetId: id, reason, note });
  return updated;
}
