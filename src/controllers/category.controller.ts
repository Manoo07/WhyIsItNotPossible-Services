import type { Request, Response } from "express";
import * as categoryService from "../services/category.service.js";
import { CreateCategoryBody, UpdateCategoryBody } from "../lib/validation.js";
import { BadRequestError } from "../lib/errors.js";

export async function list(_req: Request, res: Response) {
  res.json(await categoryService.list());
}

export async function create(req: Request, res: Response) {
  const body = CreateCategoryBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.status(201).json(await categoryService.create(body.data));
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  const body = UpdateCategoryBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await categoryService.update(id, body.data));
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  await categoryService.remove(id);
  res.json({ success: true });
}
