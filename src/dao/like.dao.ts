import { prisma } from "../lib/prisma.js";

export function find(postId: number, userId: number) {
  return prisma.like.findUnique({ where: { postId_userId: { postId, userId } } });
}

export function create(postId: number, userId: number) {
  return prisma.like.create({ data: { postId, userId } });
}

export function remove(postId: number, userId: number) {
  return prisma.like.delete({ where: { postId_userId: { postId, userId } } });
}

export function countByPost(postId: number) {
  return prisma.like.count({ where: { postId } });
}

export function countByAuthor(authorId: number) {
  return prisma.like.count({ where: { post: { authorId } } });
}

export function countAll() {
  return prisma.like.count();
}
