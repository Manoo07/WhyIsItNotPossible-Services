import "express-session";

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
