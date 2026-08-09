import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import { processFanout } from "./notification.service.js";
import { getEmailQueue, getFanoutQueue } from "../queues/notification.queue.js";

// Needs real Postgres (DATABASE_URL) + Redis (REDIS_URL) — run via
// `yarn test:integration`. Pins down the cursor-pagination boundary the
// batched fanout depends on (FRS §22): a follower count that spans more
// than one FANOUT_BATCH_SIZE page must still produce exactly one
// notification per eligible follower, with none lost or duplicated at the
// page boundary. See docs/notification-system-architecture-review.md #9.
const FANOUT_BATCH_SIZE = 500;
const FOLLOWER_COUNT = FANOUT_BATCH_SIZE + 5;

describe("notification fanout batching (integration)", () => {
  let authorId: number;
  let postId: number;
  let followerIds: number[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const author = await prisma.user.create({
      data: { username: `it-fanout-author-${stamp}`, email: `it-fanout-author-${stamp}@test.local`, passwordHash: "x", role: "author" },
    });
    authorId = author.id;

    const followers = await prisma.user.createManyAndReturn({
      data: Array.from({ length: FOLLOWER_COUNT }, (_, i) => ({
        username: `it-fanout-follower-${stamp}-${i}`,
        email: `it-fanout-follower-${stamp}-${i}@test.local`,
        passwordHash: "x",
        role: "reader" as const,
      })),
      select: { id: true },
    });
    followerIds = followers.map((f) => f.id);

    await prisma.authorFollow.createMany({
      data: followerIds.map((userId) => ({ userId, authorId, notificationEnabled: true })),
    });

    const post = await prisma.post.create({
      data: { title: "Fanout integration test post", slug: `it-fanout-post-${stamp}`, content: "content", status: "published", authorId },
    });
    postId = post.id;
  }, 30000);

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { postId } });
    await prisma.authorFollow.deleteMany({ where: { authorId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.user.deleteMany({ where: { id: { in: [...followerIds, authorId] } } });
    await getFanoutQueue().close();
    await getEmailQueue().close();
  }, 30000);

  it(`creates exactly one notification per follower across the ${FANOUT_BATCH_SIZE}-row batch boundary`, async () => {
    await processFanout(postId);

    const notifications = await prisma.notification.findMany({ where: { postId } });
    expect(notifications).toHaveLength(FOLLOWER_COUNT);
    expect(new Set(notifications.map((n) => n.userId)).size).toBe(FOLLOWER_COUNT);
    expect(notifications.every((n) => n.status === "pending")).toBe(true);
  }, 30000);
});
