import type { Request } from "express";

export function parsePagination(req: Request, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? String(defaultLimit))), 1), maxLimit);
  return { page, limit };
}
