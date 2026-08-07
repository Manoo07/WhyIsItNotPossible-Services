import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session?.user) {
    next(new UnauthorizedError());
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.session.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
