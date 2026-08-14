import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Ordered by usage (post count) descending, name ascending as a tiebreak —
// so "popular tags" is an actual ranking, not just insertion order truncated
// on the frontend. Tags with zero posts sort last and are dropped when a
// limit is given, since an unused tag isn't "popular."
export function findMany({ limit }: { limit?: number } = {}) {
  return prisma.tag.findMany({
    where: limit !== undefined ? { postTags: { some: {} } } : undefined,
    orderBy: [{ postTags: { _count: "desc" } }, { name: "asc" }],
    take: limit,
    include: { _count: { select: { postTags: true } } },
  });
}

export function findBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug } });
}

export function create(data: Prisma.TagCreateInput) {
  return prisma.tag.create({ data });
}

export function update(id: number, data: Prisma.TagUpdateInput) {
  return prisma.tag.update({ where: { id }, data });
}

// deleteMany (not delete) so removing an already-gone tag is a no-op
// instead of throwing — matches category.dao.ts's remove. The PostTag rows
// cascade automatically (see schema's onDelete: Cascade on PostTag.tag).
export function remove(id: number) {
  return prisma.tag.deleteMany({ where: { id } });
}

export function findPostTagsByPost(postId: number) {
  return prisma.postTag.findMany({ where: { postId }, include: { tag: true } });
}

export function findPostTagsByTag(tagId: number) {
  return prisma.postTag.findMany({ where: { tagId } });
}

// Every (postId, tagId) row where the post carries one of the given tags —
// used to score candidate posts by how many tags they share with a source
// post, rather than just "same category, most viewed."
export function findPostTagsForTagIds(tagIds: number[], excludePostId: number) {
  return prisma.postTag.findMany({
    where: { tagId: { in: tagIds }, postId: { not: excludePostId } },
    select: { postId: true },
  });
}

export function upsertPostTag(postId: number, tagId: number) {
  return prisma.postTag.upsert({
    where: { postId_tagId: { postId, tagId } },
    create: { postId, tagId },
    update: {},
  });
}

export function deletePostTagsByPost(postId: number) {
  return prisma.postTag.deleteMany({ where: { postId } });
}
