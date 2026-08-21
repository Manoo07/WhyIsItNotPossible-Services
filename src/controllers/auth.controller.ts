import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { toPublicUser } from "../services/user.service.js";
import {
  RegisterBody,
  LoginBody,
  VerifyEmailBody,
  ResendOtpBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

// Registration no longer establishes a session — the account exists but
// can't log in until the emailed code is verified (see authService.login's
// emailVerifiedAt check), so there's nothing to log in to yet.
export async function register(req: Request, res: Response) {
  const body = RegisterBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  const user = await authService.register(body.data);
  res.status(201).json({ email: user.email });
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

// Successful verification is what actually logs the user in for the first
// time — same session shape as login.
export async function verifyEmail(req: Request, res: Response) {
  const body = VerifyEmailBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  const user = await authService.verifyEmail(body.data);
  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
  res.json({ user: toPublicUser(user) });
}

export async function resendOtp(req: Request, res: Response) {
  const body = ResendOtpBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  await authService.resendVerification(body.data);
  res.json({ success: true });
}

export async function forgotPassword(req: Request, res: Response) {
  const body = ForgotPasswordBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  await authService.forgotPassword(body.data);
  res.json({ success: true });
}

export async function resetPassword(req: Request, res: Response) {
  const body = ResetPasswordBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  await authService.resetPassword(body.data);
  res.json({ success: true });
}
