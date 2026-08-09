import rateLimit, { type Options } from "express-rate-limit";
import type { Request, Response } from "express";

// Four tiers, each aimed at a specific threat this app actually faces —
// not a blanket "rate limit everything the same amount," which would
// either be too loose to matter or too strict for normal browsing:
//
//   apiLimiter    — baseline DDoS/scraping protection, every /api/* route.
//   authLimiter   — brute-force / credential-stuffing protection on login
//                   and register specifically.
//   uploadLimiter — every call costs real AWS money (S3 PUT + storage), so
//                   this is keyed per-user, not just per-IP.
//   reportLimiter — spam-report protection, also per-user.
//
// Uses express-rate-limit's default in-memory store on purpose: this app
// runs as a single process, so there's nothing to synchronize across, and
// in-memory means one less piece of infrastructure to keep running in
// production. If this ever needs to run as multiple instances behind a
// load balancer, swap in a Redis store (this app already depends on Redis
// for BullMQ) — until then, the extra moving part isn't worth it.

function jsonHandler(req: Request, res: Response, _next: unknown, options: Options) {
  res.status(options.statusCode).json({ error: "Too many requests. Please slow down and try again shortly." });
}

function userOrIpKey(req: Request): string {
  const userId = req.session?.user?.id;
  return userId ? `user-${userId}` : (req.ip ?? "unknown");
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
  // Login/register have no session yet, so this is always IP-keyed —
  // express-rate-limit's default keyGenerator already does this correctly.
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: jsonHandler,
});

export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: jsonHandler,
});
