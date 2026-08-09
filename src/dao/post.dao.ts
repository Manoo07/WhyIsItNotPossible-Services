import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findMany(
  where: Prisma.PostWhereInput,
  orderBy: Prisma.PostOrderByWithRelationInput,
  opts?: { skip?: number; take?: number },
) {
  return prisma.post.findMany({ where, orderBy, ...opts });
}

export function findById(id: number) {
  return prisma.post.findUnique({ where: { id } });
}

export function findBySlug(slug: string) {
  return prisma.post.findUnique({ where: { slug } });
}

export function count(where: Prisma.PostWhereInput) {
  return prisma.post.count({ where });
}

export function sumViewCount(where: Prisma.PostWhereInput) {
  return prisma.post.aggregate({ _sum: { viewCount: true }, where });
}

export function create(data: Prisma.PostUncheckedCreateInput) {
  return prisma.post.create({ data });
}

export function update(id: number, data: Prisma.PostUpdateInput) {
  return prisma.post.update({ where: { id }, data });
}

export function remove(id: number) {
  return prisma.post.delete({ where: { id } });
}
