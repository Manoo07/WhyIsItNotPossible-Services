import type { AuditTargetType } from "@prisma/client";
import * as auditLogDao from "../dao/audit-log.dao.js";

export interface RecordActionInput {
  adminId: number;
  action: string;
  targetType: AuditTargetType;
  targetId: number;
  reason?: string | null;
  note?: string | null;
}

// The single write path every admin mutation goes through (FRS §14: "The
// admin must never be able to silently modify moderation state. Every
// transition creates an audit record."). Admin services call this instead
// of writing to AuditLog directly, so there's exactly one place that can
// create a record — matching the "append-only, no update/delete DAO
// functions" contract in audit-log.dao.ts.
export function recordAction(input: RecordActionInput) {
  return auditLogDao.create(input);
}

export interface ListAuditLogsInput {
  page: number;
  limit: number;
  adminId?: number;
  targetType?: AuditTargetType;
  action?: string;
}

export async function list(params: ListAuditLogsInput) {
  const { page, limit, adminId, targetType, action } = params;

  const where = {
    ...(adminId ? { adminId } : {}),
    ...(targetType ? { targetType } : {}),
    ...(action ? { action } : {}),
  };

  const [logs, total] = await Promise.all([
    auditLogDao.findMany(where, { skip: (page - 1) * limit, take: limit }),
    auditLogDao.count(where),
  ]);

  return { logs, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listForTarget(targetType: AuditTargetType, targetId: number, page: number, limit: number) {
  const [logs, total] = await Promise.all([
    auditLogDao.findByTarget(targetType, targetId, { skip: (page - 1) * limit, take: limit }),
    auditLogDao.countByTarget(targetType, targetId),
  ]);
  return { logs, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
