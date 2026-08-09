import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";
import * as userDao from "../dao/user.dao.js";

// Re-validates the session against the current DB row on every authenticated
// request. This app's sessions are process-local (no shared session store),
// so re-checking here — rather than trusting the data cached in the cookie
// at login — is what makes admin-triggered suspension/restriction/force-
// logout take effect immediately instead of only at the session's natural
// expiry. See docs/*/codebase-architecture-review.md for the general
// "policy lives in one place" reasoning this follows.
async function loadActiveUser(req: Request) {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    throw new UnauthorizedError();
  }

  const user = await userDao.findById(sessionUser.id);
  if (!user) {
    throw new UnauthorizedError();
  }

  // A timed suspension that has lapsed is treated as over on the next
  // request that hits it, without needing an admin or a cron job to
  // explicitly restore the account.
  if (user.status === "suspended" && user.suspendedUntil && user.suspendedUntil <= new Date()) {
    await userDao.update(user.id, { status: "active", suspendedUntil: null, statusReason: null });
    user.status = "active";
  }

  if (user.sessionVersion !== sessionUser.sessionVersion) {
    throw new UnauthorizedError("Session expired, please log in again");
  }

  if (user.status !== "active") {
    const message =
      user.status === "suspended" ? "Account suspended" : user.status === "restricted" ? "Account restricted" : "Account no longer active";
    throw new ForbiddenError(message);
  }

  // Best-effort, throttled — this only feeds the admin "Last Active" column,
  // so it isn't worth a write on every single request or worth failing the
  // request over.
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > FIVE_MINUTES_MS) {
    void userDao.update(user.id, { lastActiveAt: new Date() }).catch(() => {});
  }

  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    await loadActiveUser(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = await loadActiveUser(req);
      if (!roles.includes(user.role)) {
        throw new ForbiddenError();
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// This app reuses its existing top-level "owner" role as the FRS's
// SUPER_ADMIN rather than adding a parallel admin role — see
// docs/admin-console-architecture-notes.md. Named separately from
// requireRole("owner") only so admin routes read as "this needs an admin,"
// not "this needs an owner," at the call site.
export const requireAdmin = requireRole("owner");
