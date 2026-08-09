import { Worker } from "bullmq";
import { getRedisConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { FANOUT_QUEUE_NAME, type FanoutJobData } from "../queues/notification.queue.js";
import { processFanout } from "../services/notification.service.js";

export function startFanoutWorker(): Worker<FanoutJobData> {
  const worker = new Worker<FanoutJobData>(
    FANOUT_QUEUE_NAME,
    async (job) => {
      await processFanout(job.data.postId);
    },
    { connection: getRedisConnection(), concurrency: 5 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, postId: job?.data.postId, err }, "notification fanout job failed");
  });

  return worker;
}
