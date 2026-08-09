import type { Request, Response } from "express";
import * as adminPostService from "../services/admin-post.service.js";
import { AdminUpdatePostStatusBody } from "../lib/validation.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";

export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const removed = String(req.query.removed ?? "");
  const authorId = req.query.authorId ? parseInt(String(req.query.authorId)) : null;

  res.json(await adminPostService.listPosts({ page, limit, search, status, removed, authorId }));
}

export async function detail(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    throw new NotFoundError("Post not found");
  }
  res.json(await adminPostService.getPostDetail(id));
}

export async function listReports(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { page, limit } = parsePagination(req, 10);
  res.json(await adminPostService.listPostReports(id, page, limit));
}

export async function listModerationHistory(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { page, limit } = parsePagination(req, 10);
  res.json(await adminPostService.listPostModerationHistory(id, page, limit));
}

export async function updateStatus(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminUpdatePostStatusBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  const adminId = req.session.user!.id;
  const result =
    body.data.action === "remove"
      ? await adminPostService.removePost(adminId, id, body.data)
      : await adminPostService.restorePost(adminId, id, body.data);
  res.json(result);
}
