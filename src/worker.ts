import { logger } from "./lib/logger.js";
import { startFanoutWorker } from "./workers/notification-fanout.worker.js";
import { startEmailWorker } from "./workers/notification-email.worker.js";

// Separate process from the API server (src/index.ts) on purpose: this is
// the standalone notification consumer — `yarn worker` / `node dist/worker.mjs`.
// It can be started, stopped, and scaled independently of the API, which
// only ever touches Redis to enqueue a fanout job, never to process one.
const fanoutWorker = startFanoutWorker();
const emailWorker = startEmailWorker();

logger.info("Notification worker started (fanout + email queues)");

async function shutdown(signal: string) {
  logger.info({ signal }, "Notification worker shutting down");
  await Promise.all([fanoutWorker.close(), emailWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
