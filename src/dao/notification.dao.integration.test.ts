import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma.js";
import * as notificationDao from "./notification.dao.js";

// Needs a real Postgres (DATABASE_URL) — run via `yarn test:integration`.
// Verifies the actual DB-level duplicate-prevention this system depends on
// (FRS §8): skipDuplicates against the (userId, postId, type) unique
// constraint. A mocked-Prisma unit test can't prove this — it would only
// prove the mock was called, not that the constraint actually dedupes.
// See docs/notification-system-architecture-review.md #9.
describe("notification.dao duplicate prevention (integration)", () => {
  let authorId: number;
  let userId: number;
  let postId: number;

  beforeAll(async () => {
    const stamp = Date.now();
    const author = await prisma.user.create({
      data: { username: `it-author-${stamp}`, email: `it-author-${stamp}@test.local`, passwordHash: "x", role: "author" },
    });
    const user = await prisma.user.create({
      data: { username: `it-user-${stamp}`, email: `it-user-${stamp}@test.local`, passwordHash: "x", role: "reader" },
    });
    const post = await prisma.post.create({
      data: { title: "Integration test post", slug: `it-post-${stamp}`, content: "content", status: "published", authorId: author.id },
    });
    authorId = author.id;
    userId = user.id;
    postId = post.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.user.deleteMany({ where: { id: { in: [authorId, userId] } } });
  });

  it("skips a duplicate (userId, postId, type) row on a second call", async () => {
    const first = await notificationDao.createPendingBatch([{ userId, authorId, postId }]);
    expect(first).toHaveLength(1);

    const second = await notificationDao.createPendingBatch([{ userId, authorId, postId }]);
    expect(second).toHaveLength(0);

    const rows = await prisma.notification.findMany({ where: { userId, postId } });
    expect(rows).toHaveLength(1);
  });
});
