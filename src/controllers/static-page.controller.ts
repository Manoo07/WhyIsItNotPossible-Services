import type { Request, Response } from "express";
import * as staticPageService from "../services/static-page.service.js";
import { UpdateStaticPageBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function list(_req: Request, res: Response) {
  res.json(await staticPageService.list());
}

export async function getBySlug(req: Request<{ slug: string }>, res: Response) {
  res.json(await staticPageService.getBySlug(req.params.slug));
}

export async function update(req: Request<{ slug: string }>, res: Response) {
  const body = UpdateStaticPageBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await staticPageService.update(req.params.slug, body.data));
}
