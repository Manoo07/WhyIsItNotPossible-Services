import * as followDao from "../dao/follow.dao.js";
import * as notificationDao from "../dao/notification.dao.js";
import * as postDao from "../dao/post.dao.js";
import { sendMail } from "../lib/mailer.js";
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
  const postUrl = `${FRONTEND_URL}/blog/${notification.post.slug}`;
  const preferencesUrl = `${FRONTEND_URL}/settings?tab=notifications`;

  const subject = `${authorName} published a new post: ${notification.post.title}`;
  const text = [
    `${authorName} just published a new post.`,
    "",
    notification.post.title,
    "",
    `Read it: ${postUrl}`,
    "",
    `You are receiving this email because you follow ${authorName}.`,
    `Manage notification preferences: ${preferencesUrl}`,
  ].join("\n");
  const html = `
    <p>${authorName} just published a new post.</p>
    <h2><a href="${postUrl}">${notification.post.title}</a></h2>
    <p><a href="${postUrl}">Read Post</a></p>
    <hr />
    <p style="color:#666;font-size:12px;">
      You are receiving this email because you follow ${authorName}.<br />
      <a href="${preferencesUrl}">Manage notification preferences</a>
    </p>
  `;

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
