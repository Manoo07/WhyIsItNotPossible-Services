import type { Request, Response } from "express";
import * as reportService from "../services/report.service.js";
import { SubmitReportBody, AdminDecideReportBody } from "../lib/validation.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";

// Consumer-facing — any authenticated user can report a post, comment, or
// another user.
export async function submit(req: Request, res: Response) {
  const body = SubmitReportBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.status(201).json(await reportService.submitReport(req.session.user!.id, body.data));
}

// Everything below is admin-only (mounted behind requireAdmin).

export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  const status = String(req.query.status ?? "");
  const priority = String(req.query.priority ?? "");
  const targetType = String(req.query.targetType ?? "");
  const assignedToId = req.query.assignedToId ? parseInt(String(req.query.assignedToId)) : null;

  res.json(await reportService.listReports({ page, limit, status, priority, targetType, assignedToId }));
}

export async function detail(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    throw new NotFoundError("Report not found");
  }
  res.json(await reportService.getReportDetail(id));
}

export async function listRelated(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { page, limit } = parsePagination(req, 10);
  res.json(await reportService.listRelatedReports(id, page, limit));
}

export async function listModerationHistory(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { page, limit } = parsePagination(req, 10);
  res.json(await reportService.listModerationHistory(id, page, limit));
}

export async function decide(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  const body = AdminDecideReportBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await reportService.decide(req.session.user!.id, id, body.data));
}
