import { prisma } from "../lib/prisma.js";

export function findByUserAndAuthor(userId: number, authorId: number) {
  return prisma.authorFollow.findUnique({ where: { userId_authorId: { userId, authorId } } });
}

// Idempotent: calling this for an already-followed author just returns the
// existing row rather than erroring (FRS section 21, "Already Following").
export function upsertFollow(userId: number, authorId: number) {
  return prisma.authorFollow.upsert({
    where: { userId_authorId: { userId, authorId } },
    update: {},
    create: { userId, authorId, notificationEnabled: true },
  });
}

// Idempotent for the same reason: unfollowing an author you don't follow
// is a no-op success (FRS section 21, "Already Unfollowed"), not an error.
export async function removeFollow(userId: number, authorId: number): Promise<boolean> {
  const { count } = await prisma.authorFollow.deleteMany({ where: { userId, authorId } });
  return count > 0;
}

export function updateNotificationPreference(userId: number, authorId: number, enabled: boolean) {
  return prisma.authorFollow.update({
    where: { userId_authorId: { userId, authorId } },
    data: { notificationEnabled: enabled },
  });
}

export function listFollowedByUser(userId: number, opts: { skip: number; take: number }) {
  return prisma.authorFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    ...opts,
  });
}

export function countFollowedByUser(userId: number) {
  return prisma.authorFollow.count({ where: { userId } });
}

export function countFollowers(authorId: number) {
  return prisma.authorFollow.count({ where: { authorId } });
}

export function countFollowing(userId: number) {
  return prisma.authorFollow.count({ where: { userId } });
}

// Cursor-paginated (not offset/skip) so this stays cheap at any follower
// count — an author with a million followers pages through this the same
// way an author with ten does, without the query getting slower per page.
export function findEligibleFollowersBatch(authorId: number, cursorId: number | null, batchSize: number) {
  return prisma.authorFollow.findMany({
    where: {
      authorId,
      notificationEnabled: true,
      user: { emailNotificationsGlobal: true },
    },
    orderBy: { id: "asc" },
    take: batchSize,
    ...(cursorId !== null ? { skip: 1, cursor: { id: cursorId } } : {}),
    select: { id: true, userId: true },
  });
}
