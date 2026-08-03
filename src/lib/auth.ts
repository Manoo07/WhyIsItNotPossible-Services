import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";

// Session user shape
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.session.user.role)) {
      res.status(403).json({ error: "Not authorised" });
      return;
    }
    next();
  };
}

export function toPublicUser(user: User) {
  const { passwordHash: _ph, ...rest } = user;
  return rest;
}
