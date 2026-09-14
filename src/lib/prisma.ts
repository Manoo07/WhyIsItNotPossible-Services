import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "./logger.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "warn", emit: "event" },
    { level: "error", emit: "event" },
  ],
});

// Covers every DAO's queries in one place rather than a log line in each —
// query/params are debug-level (set LOG_LEVEL=debug to actually see them;
// default "info" keeps normal operation quiet), warn/error are always on.
prisma.$on("query", (e: Prisma.QueryEvent) => {
  logger.debug({ query: e.query, params: e.params, duration: e.duration }, "Prisma query");
});
prisma.$on("warn", (e: Prisma.LogEvent) => {
  logger.warn({ message: e.message }, "Prisma warning");
});
prisma.$on("error", (e: Prisma.LogEvent) => {
  logger.error({ message: e.message }, "Prisma error");
});
