import * as followDao from "../dao/follow.dao.js";
import * as notificationDao from "../dao/notification.dao.js";
import * as postDao from "../dao/post.dao.js";
import { sendMail } from "../lib/mailer.js";
import { buildNewPostEmail, type RelatedPostSummary } from "../lib/new-post-email.js";
import { logger } from "../lib/logger.js";
import { getEmailQueue } from "../queues/notification.queue.js";

const FANOUT_BATCH_SIZE = 500;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Runs in the fanout worker. Walks an author's followers in fixed-size
// batches (cursor-based, so this is just as cheap on page 2000 as page 1 —
// no OFFSET scan) and bulk-queues one email job per batch instead of
// looping `queue.add()` per follower. addBulk is a single Redis pipeline
// call per batch regardless of batch size, so an author with a million
// followers costs ~2000 round trips (1M / 500), not 1,000,000.
export async function processFanout(postId: number): Promise<void> {
  const post = await postDao.findById(postId);
  if (!post) {
    logger.warn({ postId }, "notification fanout: post not found, skipping");
    return;
  }
  if (post.status !== "published") {
    logger.warn({ postId }, "notification fanout: post is not published, skipping");
    return;
  }

  const emailQueue = getEmailQueue();
  let cursorId: number | null = null;
  let totalEligible = 0;
  let totalQueued = 0;

  for (;;) {
    const batch = await followDao.findEligibleFollowersBatch(post.authorId, cursorId, FANOUT_BATCH_SIZE);
    if (batch.length === 0) break;

    totalEligible += batch.length;

    const created = await notificationDao.createPendingBatch(
      batch.map((f) => ({ userId: f.userId, authorId: post.authorId, postId })),
    );

    if (created.length > 0) {
      await emailQueue.addBulk(
        created.map((n) => ({
          name: "send-email",
          data: { notificationId: n.id },
          opts: {
            jobId: `notify-email-${n.id}`,
            attempts: 3,
            backoff: { type: "exponential" as const, delay: 5000 },
            removeOnComplete: true,
            removeOnFail: 1000,
          },
        })),
      );
      totalQueued += created.length;
    }

    cursorId = batch[batch.length - 1].id;
    if (batch.length < FANOUT_BATCH_SIZE) break;
  }

  logger.info(
    { postId, authorId: post.authorId, eligibleFollowers: totalEligible, emailsQueued: totalQueued },
    "notification fanout complete",
  );
}

// Runs in the email worker, one notification at a time.
// "More from <category>" in the new-post email. One publish fans out to
// every follower, so the same list would otherwise be queried once per
// recipient; a short per-post cache turns that into roughly one query per
// publish. Short-lived so a later post doesn't get a stale list.
const RELATED_CACHE_TTL_MS = 10 * 60 * 1000;
const relatedCache = new Map<number, { at: number; posts: RelatedPostSummary[] }>();

async function relatedPostsFor(postId: number, categoryId: number | null): Promise<RelatedPostSummary[]> {
  if (!categoryId) return [];
  const cached = relatedCache.get(postId);
  if (cached && Date.now() - cached.at < RELATED_CACHE_TTL_MS) return cached.posts;

  const rows = await postDao.findManyList(
    { status: "published", removedAt: null, categoryId, id: { not: postId } },
    { publishedAt: "desc" },
    { take: 3 },
  );
  const posts = rows.map((r) => ({ slug: r.slug, title: r.title, coverImageUrl: r.coverImageUrl, readingTime: r.readingTime }));

  for (const [id, entry] of relatedCache) {
    if (Date.now() - entry.at >= RELATED_CACHE_TTL_MS) relatedCache.delete(id);
  }
  relatedCache.set(postId, { at: Date.now(), posts });
  return posts;
}

export async function processSendEmail(notificationId: number): Promise<void> {
  const notification = await notificationDao.findById(notificationId);
  if (!notification) {
    logger.warn({ notificationId }, "notification email: record not found, skipping");
    return;
  }

  // Guards against a job being re-processed after it already succeeded
  // (e.g. a manual retry of a completed job) — the FRS's duplicate-
  // prevention requirement applies to retries, not just first attempts.
  if (notification.status === "sent") {
    return;
  }

  const authorName = notification.author.displayName || notification.author.username;
  // A related-posts lookup failing shouldn't cost the reader the email —
  // the list is a bonus, so fall back to sending without it.
  const related = await relatedPostsFor(notification.post.id, notification.post.categoryId).catch((err) => {
    logger.warn({ notificationId, err }, "notification email: related posts lookup failed, sending without");
    return [];
  });
  const { subject, html, text } = buildNewPostEmail({
    author: { name: authorName, avatarUrl: notification.author.avatarUrl },
    post: notification.post,
    related,
    siteUrl: FRONTEND_URL.replace(/\/+$/, ""),
  });

  try {
    await sendMail({ to: notification.user.email, subject, html, text });
    await notificationDao.markSent(notificationId);
    logger.info({ notificationId, userId: notification.userId, postId: notification.postId }, "notification email sent");
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error";
    await notificationDao.markFailed(notificationId, reason);
    logger.error({ notificationId, err }, "notification email failed, will retry via queue");
    // Rethrow so BullMQ counts this attempt as failed and applies the
    // queue's retry/backoff policy (attempts: 3, exponential backoff).
    throw err;
  }
}
