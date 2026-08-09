import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { toPublicUser } from "../services/user.service.js";
import { RegisterBody, LoginBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function register(req: Request, res: Response) {
  const body = RegisterBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  const user = await authService.register(body.data);
  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
  res.status(201).json({ user: toPublicUser(user) });
}

export async function login(req: Request, res: Response) {
  const body = LoginBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  const user = await authService.login(body.data);
  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
  res.json({ user: toPublicUser(user) });
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => {
    res.json({ success: true });
  });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.session.user!.id);
  res.json(toPublicUser(user));
}
