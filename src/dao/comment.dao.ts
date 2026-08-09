import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Moderator-removed comments are excluded by default — admin/moderation
// code that needs to see them anyway (report-target resolution, restoring)
// goes through findById, which is intentionally unfiltered.
export function findManyByPost(postId: number, opts: { includeRemoved?: boolean; skip: number; take: number }) {
  return prisma.comment.findMany({
    where: { postId, ...(opts.includeRemoved ? {} : { removedAt: null }) },
    orderBy: { createdAt: "asc" },
    skip: opts.skip,
    take: opts.take,
  });
}

export function findById(id: number) {
  return prisma.comment.findUnique({ where: { id } });
}

export function countByPost(postId: number) {
  return prisma.comment.count({ where: { postId, removedAt: null } });
}

export function create(data: { postId: number; userId: number; content: string; parentId: number | null }) {
  return prisma.comment.create({ data });
}

export function update(id: number, data: Prisma.CommentUpdateInput) {
  return prisma.comment.update({ where: { id }, data });
}

// Hard delete — used only for a user removing their own comment
// (comment.service.ts's removeComment). Moderation removal goes through
// update() with removedAt set instead, so it can be restored.
export function remove(id: number) {
  return prisma.comment.delete({ where: { id } });
}
