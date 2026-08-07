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

export async function getBookmarks(userId: number) {
  const bookmarkRows = await bookmarkDao.findManyByUser(userId);

  const posts = await Promise.all(
    bookmarkRows.map(async ({ postId }) => {
      const post = await postDao.findById(postId);
      return post ? enrichPost(post, userId) : null;
    }),
  );
  return posts.filter(Boolean);
}

export async function getMyPosts(userId: number) {
  const posts = await postDao.findMany({ authorId: userId }, { createdAt: "desc" });
  return Promise.all(posts.map((p) => enrichPost(p, userId)));
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
