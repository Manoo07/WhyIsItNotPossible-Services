import type { Request, Response } from "express";
import * as authorApplicationService from "../services/author-application.service.js";
import { SubmitAuthorApplicationBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function submit(req: Request, res: Response) {
  const body = SubmitAuthorApplicationBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }

  const application = await authorApplicationService.submit(req.session.user!, body.data);
  res.status(201).json(application);
}

export async function getMine(req: Request, res: Response) {
  const application = await authorApplicationService.getMine(req.session.user!.id);
  res.json(application);
}
