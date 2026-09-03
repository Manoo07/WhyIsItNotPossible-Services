import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findMany(
  where: Prisma.PostWhereInput,
  orderBy: Prisma.PostOrderByWithRelationInput,
  opts?: { skip?: number; take?: number },
) {
  return prisma.post.findMany({ where, orderBy, ...opts });
}

// Everything a card/list view (grid, search results, related posts) needs
// to render — deliberately without `content`. That field alone runs 2-10KB
// of HTML per post; a 20-40 post listing page has no reason to ship that
// over the wire (or read it off disk) when only the detail page renders it.
// Keep this in sync with the frontend's `Post` (list) vs `PostDetail` type.
export const LIST_SELECT = {
  id: true,
  title: true,
  subtitle: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  status: true,
  featured: true,
  authorId: true,
  categoryId: true,
  viewCount: true,
  readingTime: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
} satisfies Prisma.PostSelect;

export type PostListRow = Prisma.PostGetPayload<{ select: typeof LIST_SELECT }>;

export function findManyList(
  where: Prisma.PostWhereInput,
  orderBy: Prisma.PostOrderByWithRelationInput,
  opts?: { skip?: number; take?: number },
): Promise<PostListRow[]> {
  return prisma.post.findMany({ where, orderBy, select: LIST_SELECT, ...opts });
}

export function findByIdList(id: number): Promise<PostListRow | null> {
  return prisma.post.findUnique({ where: { id }, select: LIST_SELECT });
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
