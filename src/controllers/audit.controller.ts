import type { Request, Response } from "express";
import * as auditService from "../services/audit.service.js";

// Read-only — there is deliberately no update/delete route for audit logs
// (FRS §19: "Admins should not be able to edit or delete audit records").
export async function list(req: Request, res: Response) {
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  const adminId = req.query.adminId ? parseInt(String(req.query.adminId)) : undefined;
  const targetType = req.query.targetType ? String(req.query.targetType) : undefined;
  const action = req.query.action ? String(req.query.action) : undefined;

  res.json(
    await auditService.list({
      page,
      limit,
      adminId,
      targetType: targetType as "user" | "post" | "comment" | "report" | undefined,
      action,
    }),
  );
}
