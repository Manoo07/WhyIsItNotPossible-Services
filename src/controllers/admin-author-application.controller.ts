import type { Request, Response } from "express";
import * as adminAuthorApplicationService from "../services/admin-author-application.service.js";
import { AdminDecideAuthorApplicationBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  const status = String(req.query.status ?? "");

  res.json(await adminAuthorApplicationService.list({ page, limit, status }));
}

export async function detail(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  res.json(await adminAuthorApplicationService.detail(id));
}

export async function decide(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminDecideAuthorApplicationBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  res.json(await adminAuthorApplicationService.decide(req.session.user!.id, id, body.data));
}
