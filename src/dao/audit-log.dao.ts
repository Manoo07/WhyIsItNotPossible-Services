import type { Prisma, AuditTargetType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// No update()/remove() exported on purpose — the audit log is append-only
// from the admin application's perspective (FRS §19).
export function create(data: {
  adminId: number;
  action: string;
  targetType: AuditTargetType;
  targetId: number;
  reason?: string | null;
  note?: string | null;
}) {
  return prisma.auditLog.create({ data });
}

export function findMany(where: Prisma.AuditLogWhereInput, opts: { skip: number; take: number }) {
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { id: true, username: true, displayName: true } } },
    ...opts,
  });
}

export function count(where: Prisma.AuditLogWhereInput) {
  return prisma.auditLog.count({ where });
}

export function findByTarget(
  targetType: AuditTargetType,
  targetId: number,
  opts: { skip: number; take: number },
) {
  return prisma.auditLog.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { id: true, username: true, displayName: true } } },
    ...opts,
  });
}

export function countByTarget(targetType: AuditTargetType, targetId: number) {
  return prisma.auditLog.count({ where: { targetType, targetId } });
}
