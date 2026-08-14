import type { Request, Response } from "express";
import * as tagService from "../services/tag.service.js";
import { CreateTagBody, UpdateTagBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function list(req: Request, res: Response) {
  const limit = req.query.limit !== undefined ? parseInt(String(req.query.limit)) : undefined;
  res.json(await tagService.list(limit));
}

export async function create(req: Request, res: Response) {
  const body = CreateTagBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.status(201).json(await tagService.create(body.data));
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  const body = UpdateTagBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await tagService.update(id, body.data));
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  await tagService.remove(id);
  res.json({ success: true });
}
