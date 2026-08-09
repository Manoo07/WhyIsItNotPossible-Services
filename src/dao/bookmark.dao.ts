import { prisma } from "../lib/prisma.js";

export function find(postId: number, userId: number) {
  return prisma.bookmark.findUnique({ where: { postId_userId: { postId, userId } } });
}

export function create(postId: number, userId: number) {
  return prisma.bookmark.create({ data: { postId, userId } });
}

export function remove(postId: number, userId: number) {
  return prisma.bookmark.delete({ where: { postId_userId: { postId, userId } } });
}

export function findManyByUser(userId: number, opts: { skip: number; take: number }) {
  return prisma.bookmark.findMany({ where: { userId }, orderBy: { postId: "desc" }, ...opts });
}

export function countByUser(userId: number) {
  return prisma.bookmark.count({ where: { userId } });
}
