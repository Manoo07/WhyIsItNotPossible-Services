import type { Post } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Helper: enrich a post with author, category, tags, like/bookmark counts
export async function enrichPost(post: Post, userId?: number) {
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
  });

  const category = post.categoryId
    ? await prisma.category.findUnique({ where: { id: post.categoryId } })
    : null;

  const postTags = await prisma.postTag.findMany({
    where: { postId: post.id },
    include: { tag: true },
  });
  const tagRows = postTags.map((pt) => ({
    id: pt.tag.id,
    name: pt.tag.name,
    slug: pt.tag.slug,
  }));

  const [likeCount, commentCount] = await Promise.all([
    prisma.like.count({ where: { postId: post.id } }),
    prisma.comment.count({ where: { postId: post.id } }),
  ]);

  let isLiked = false;
  let isBookmarked = false;
  if (userId) {
    const [liked, bookmarked] = await Promise.all([
      prisma.like.findUnique({
        where: { postId_userId: { postId: post.id, userId } },
      }),
      prisma.bookmark.findUnique({
        where: { postId_userId: { postId: post.id, userId } },
      }),
    ]);
    isLiked = !!liked;
    isBookmarked = !!bookmarked;
  }

  const { passwordHash: _ph, ...safeAuthor } = author ?? {};

  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    author: author ? safeAuthor : undefined,
    category: category ? { ...category, postCount: 0 } : null,
    tags: tagRows,
    likeCount,
    commentCount,
    isLiked,
    isBookmarked,
  };
}
