import IORedis, { type Redis } from "ioredis";

// Lazy + shared, same rationale as lib/s3.ts: the API server must keep
// working (auth, posts, uploads) even if Redis isn't reachable — only
// follow/notification enqueue needs it, so only fail when that's attempted.
let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!connection) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL must be set to use the notification queue.");
    }
    // BullMQ requires this exact setting on any connection it's given.
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}
