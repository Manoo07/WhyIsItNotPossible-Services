import * as followDao from "../dao/follow.dao.js";
import * as userDao from "../dao/user.dao.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../lib/errors.js";
import { isAuthorRole } from "../lib/policy.js";

async function requireAuthor(authorId: number) {
  const author = await userDao.findById(authorId);
  if (!author || !isAuthorRole(author)) {
    throw new NotFoundError("Author not found");
  }
  return author;
}

export async function follow(userId: number, authorId: number) {
  if (userId === authorId) {
    throw new BadRequestError("You cannot follow yourself");
  }
  await requireAuthor(authorId);
  await followDao.upsertFollow(userId, authorId);
  return { following: true, notificationEnabled: true };
}

export async function unfollow(userId: number, authorId: number) {
  await followDao.removeFollow(userId, authorId);
  return { following: false };
}

export async function getFollowStatus(userId: number | undefined, authorId: number) {
  await requireAuthor(authorId);
  if (!userId) {
    return { following: false, notificationEnabled: false };
  }
  const row = await followDao.findByUserAndAuthor(userId, authorId);
  return { following: !!row, notificationEnabled: row?.notificationEnabled ?? false };
}

export async function updateNotificationPreference(userId: number, authorId: number, enabled: boolean) {
  const row = await followDao.findByUserAndAuthor(userId, authorId);
  if (!row) {
    throw new ForbiddenError("You are not following this author");
  }
  const updated = await followDao.updateNotificationPreference(userId, authorId, enabled);
  return { following: true, notificationEnabled: updated.notificationEnabled };
}

export async function listFollowedAuthors(userId: number, page: number, limit: number) {
  const [rows, total] = await Promise.all([
    followDao.listFollowedByUser(userId, { skip: (page - 1) * limit, take: limit }),
    followDao.countFollowedByUser(userId),
  ]);

  const authors = rows.map((row) => ({
    authorId: row.authorId,
    authorName: row.author.displayName || row.author.username,
    authorUsername: row.author.username,
    authorAvatarUrl: row.author.avatarUrl,
    following: true,
    notificationEnabled: row.notificationEnabled,
  }));

  return { authors, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getNotificationSettings(userId: number) {
  const user = await userDao.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return { emailNotificationsGlobal: user.emailNotificationsGlobal };
}

// Per FRS section 17: turning global notifications off must not touch any
// individual author's notification_enabled value, only gate whether emails
// go out. Turning it back on restores those per-author preferences as they
// were, rather than resetting them — which falls out for free here, since
// we never write to author_followers at all in this function.
export async function updateNotificationSettings(userId: number, emailNotificationsGlobal: boolean) {
  await userDao.update(userId, { emailNotificationsGlobal });
  return { emailNotificationsGlobal };
}
