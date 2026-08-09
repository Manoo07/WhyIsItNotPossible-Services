import type { Request, Response } from "express";
import * as followService from "../services/follow.service.js";
import { UpdateNotificationPreferenceBody, UpdateNotificationSettingsBody } from "../lib/validation.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";

function parseAuthorId(req: Request<{ authorId: string }>): number {
  const authorId = parseInt(req.params.authorId, 10);
  if (Number.isNaN(authorId)) {
    throw new NotFoundError("Author not found");
  }
  return authorId;
}

export async function follow(req: Request<{ authorId: string }>, res: Response) {
  const authorId = parseAuthorId(req);
  res.json(await followService.follow(req.session.user!.id, authorId));
}

export async function unfollow(req: Request<{ authorId: string }>, res: Response) {
  const authorId = parseAuthorId(req);
  res.json(await followService.unfollow(req.session.user!.id, authorId));
}

export async function getFollowStatus(req: Request<{ authorId: string }>, res: Response) {
  const authorId = parseAuthorId(req);
  res.json(await followService.getFollowStatus(req.session?.user?.id, authorId));
}

export async function updateNotificationPreference(req: Request<{ authorId: string }>, res: Response) {
  const authorId = parseAuthorId(req);
  const body = UpdateNotificationPreferenceBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await followService.updateNotificationPreference(req.session.user!.id, authorId, body.data.enabled));
}

export async function listFollowedAuthors(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);
  res.json(await followService.listFollowedAuthors(req.session.user!.id, page, limit));
}

export async function getNotificationSettings(req: Request, res: Response) {
  res.json(await followService.getNotificationSettings(req.session.user!.id));
}

export async function updateNotificationSettings(req: Request, res: Response) {
  const body = UpdateNotificationSettingsBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await followService.updateNotificationSettings(req.session.user!.id, body.data.emailNotificationsGlobal));
}
