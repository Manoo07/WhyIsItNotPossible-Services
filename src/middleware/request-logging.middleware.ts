import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

// Applied once, ahead of every route, rather than a log line hand-added to
// each of the ~30 controller functions — pino-http (see app.ts) already
// logs method/url/status/timing on completion; this adds the one thing
// that's missing to actually debug a request: what it was asking for
// (params/query/a redacted body) before the controller runs.
const REDACT_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "passwordHash",
  "code",
  "token",
]);

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) =>
      REDACT_KEYS.has(key) ? [key, "[redacted]"] : [key, value],
    ),
  );
}

export function requestLogging(req: Request, _res: Response, next: NextFunction) {
  logger.info(
    {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      body: redactBody(req.body),
    },
    "Incoming request",
  );
  next();
}
