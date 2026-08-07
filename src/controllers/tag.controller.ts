import type { Request, Response } from "express";
import * as tagService from "../services/tag.service.js";

export async function list(_req: Request, res: Response) {
  res.json(await tagService.list());
}
