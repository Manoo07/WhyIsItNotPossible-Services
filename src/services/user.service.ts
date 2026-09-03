import type { User, Prisma } from "@prisma/client";
import * as userDao from "../dao/user.dao.js";
import * as postDao from "../dao/post.dao.js";
import * as bookmarkDao from "../dao/bookmark.dao.js";
import * as likeDao from "../dao/like.dao.js";
import { enrichPost } from "./post.service.js";
import { NotFoundError } from "../lib/errors.js";

export function toPublicUser(user: User) {
  const { passwordHash: _ph, ...rest } = user;
  return rest;
}

export async function getBookmarks(userId: number, page: number, limit: number) {
  const [bookmarkRows, total] = await Promise.all([
    bookmarkDao.findManyByUser(userId, { skip: (page - 1) * limit, take: limit }),
    bookmarkDao.countByUser(userId),
  ]);

  const posts = await Promise.all(
    bookmarkRows.map(async ({ postId }) => {
      const post = await postDao.findByIdList(postId);
      return post ? enrichPost(post, userId) : null;
    }),
  );

  return { posts: posts.filter(Boolean), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getMyPosts(userId: number, page: number, limit: number, status?: "draft" | "published") {
  // The status filter matters once this is paginated, not just for
  // convenience — MyDrafts.tsx needs "my draft posts" specifically, and
  // without a server-side filter, drafts could be scrolled off the first
  // page behind newer published posts instead of just being absent from a
  // client-side filter over an unbounded list like before.
  const where = { authorId: userId, ...(status ? { status } : {}) };
  const [posts, total] = await Promise.all([
    postDao.findManyList(where, { createdAt: "desc" }, { skip: (page - 1) * limit, take: limit }),
    postDao.count(where),
  ]);
  const enriched = await Promise.all(posts.map((p) => enrichPost(p, userId)));
  return { posts: enriched, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function updateProfile(userId: number, data: Prisma.UserUpdateInput) {
  const updated = await userDao.update(userId, data);
  return toPublicUser(updated);
}

export async function getPublicProfile(username: string) {
  const user = await userDao.findByUsername(username);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const postCount = await postDao.count({ authorId: user.id, status: "published" });
  const viewsAgg = await postDao.sumViewCount({ authorId: user.id });
  const totalLikes = await likeDao.countByAuthor(user.id);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
    postCount,
    totalViews: viewsAgg._sum.viewCount ?? 0,
    totalLikes,
  };
}
