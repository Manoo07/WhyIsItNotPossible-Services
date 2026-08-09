import type { Request, Response } from "express";
import * as adminUserService from "../services/admin-user.service.js";
import { AdminUpdateUserStatusBody, AdminForceLogoutBody, AdminUpdateUserRoleBody } from "../lib/validation.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";

export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  const search = String(req.query.search ?? "");
  const status = String(req.query.status ?? "");
  const role = String(req.query.role ?? "");

  res.json(await adminUserService.listUsers({ page, limit, search, status, role }));
}

export async function detail(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    throw new NotFoundError("User not found");
  }
  res.json(await adminUserService.getUserDetail(id));
}

export async function listModerationHistory(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { page, limit } = parsePagination(req, 10);
  res.json(await adminUserService.listUserModerationHistory(id, page, limit));
}

export async function updateStatus(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminUpdateUserStatusBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await adminUserService.updateStatus(req.session.user!.id, id, body.data));
}

export async function updateRole(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminUpdateUserRoleBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await adminUserService.updateRole(req.session.user!.id, id, body.data));
}

export async function forceLogout(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminForceLogoutBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await adminUserService.forceLogout(req.session.user!.id, id, body.data.reason));
}
