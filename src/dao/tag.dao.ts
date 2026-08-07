import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findMany() {
  return prisma.tag.findMany();
}

export function findBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug } });
}

export function create(data: Prisma.TagCreateInput) {
  return prisma.tag.create({ data });
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
