import { prisma } from "../lib/prisma.js";

export function findManyByPost(postId: number) {
  return prisma.comment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
}

export function findById(id: number) {
  return prisma.comment.findUnique({ where: { id } });
}

export function countByPost(postId: number) {
  return prisma.comment.count({ where: { postId } });
}

export function create(data: { postId: number; userId: number; content: string; parentId: number | null }) {
  return prisma.comment.create({ data });
}

export function remove(id: number) {
  return prisma.comment.delete({ where: { id } });
}
