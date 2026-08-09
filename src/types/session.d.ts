import "express-session";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
  // Compared against the DB row on every request so admin-triggered
  // suspension/force-logout revokes an already-issued session immediately.
  sessionVersion: number;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}
