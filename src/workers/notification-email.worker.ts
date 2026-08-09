import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { EMAIL_QUEUE_NAME, type EmailJobData } from "../queues/notification.queue.js";
import { processSendEmail } from "../services/notification.service.js";

// Concurrency + a rate limit so this doesn't hammer the SMTP provider when
// a large batch lands at once; both are tunable via env for whatever the
// real provider's limits turn out to be.
const CONCURRENCY = Number(process.env.EMAIL_WORKER_CONCURRENCY ?? 10);
const RATE_LIMIT_MAX = Number(process.env.EMAIL_WORKER_RATE_LIMIT_MAX ?? 20);
const RATE_LIMIT_DURATION_MS = Number(process.env.EMAIL_WORKER_RATE_LIMIT_DURATION_MS ?? 1000);

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processSendEmail(job.data.notificationId);
    },
    {
      connection: getRedisConnection(),
      concurrency: CONCURRENCY,
      limiter: { max: RATE_LIMIT_MAX, duration: RATE_LIMIT_DURATION_MS },
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, notificationId: job?.data.notificationId, attemptsMade: job?.attemptsMade, err },
      "notification email job failed",
    );
  });

  return worker;
}
