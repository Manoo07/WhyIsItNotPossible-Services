import type { Request, Response } from "express";
import * as userService from "../services/user.service.js";
import { UpdateProfileBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function getBookmarks(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);
  res.json(await userService.getBookmarks(req.session.user!.id, page, limit));
}

export async function getMyPosts(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);
  const status = req.query.status === "draft" || req.query.status === "published" ? req.query.status : undefined;
  res.json(await userService.getMyPosts(req.session.user!.id, page, limit, status));
}

export async function updateProfile(req: Request, res: Response) {
  const body = UpdateProfileBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await userService.updateProfile(req.session.user!.id, body.data));
}

export async function getPublicProfile(req: Request<{ username: string }>, res: Response) {
  res.json(await userService.getPublicProfile(req.params.username));
}
