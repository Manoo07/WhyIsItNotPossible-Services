import { Queue } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";

export const FANOUT_QUEUE_NAME = "notification-fanout";
export const EMAIL_QUEUE_NAME = "notification-email";

export interface FanoutJobData {
  postId: number;
}

export interface EmailJobData {
  notificationId: number;
}

let fanoutQueue: Queue<FanoutJobData> | null = null;
let emailQueue: Queue<EmailJobData> | null = null;

export function getFanoutQueue(): Queue<FanoutJobData> {
  if (!fanoutQueue) {
    fanoutQueue = new Queue<FanoutJobData>(FANOUT_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return fanoutQueue;
}

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return emailQueue;
}

// Called synchronously from the publish-transition path in post.service.ts.
// This only performs a single, fast Redis ADD — the actual follower
// lookup and email sending happen later in the fanout worker, off the
// request path, so "publish" never blocks on "email delivery".
//
// jobId is deterministic (one fanout per post) so that if update() is
// somehow called twice for the same publish event, BullMQ de-dupes the job
// instead of fanning out twice.
export async function enqueuePostPublished(postId: number): Promise<void> {
  await getFanoutQueue().add(
    "fanout",
    { postId },
    { jobId: `fanout-${postId}`, removeOnComplete: true, removeOnFail: 1000 },
  );
}
