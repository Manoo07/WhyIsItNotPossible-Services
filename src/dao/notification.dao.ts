import { prisma } from "../lib/prisma.js";

export interface PendingNotificationInput {
  userId: number;
  authorId: number;
  postId: number;
}

// skipDuplicates relies on the (userId, postId, type) unique constraint to
// silently no-op rows that already exist — this is the DB-level half of the
// duplicate-notification prevention required by FRS section 8. Only the
// truly-new rows are returned, which is exactly the set that needs an email
// job queued.
export function createPendingBatch(rows: PendingNotificationInput[]) {
  return prisma.notification.createManyAndReturn({
    data: rows.map((r) => ({ ...r, type: "new_post" as const, status: "pending" as const })),
    skipDuplicates: true,
    select: { id: true, userId: true },
  });
}

export function findById(id: number) {
  return prisma.notification.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      author: { select: { id: true, username: true, displayName: true } },
      post: { select: { id: true, slug: true, title: true } },
    },
  });
}

export function markSent(id: number) {
  return prisma.notification.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), failureReason: null },
  });
}

export function markFailed(id: number, reason: string) {
  return prisma.notification.update({
    where: { id },
    data: { status: "failed", failureReason: reason.slice(0, 500) },
  });
}
