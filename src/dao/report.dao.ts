import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function create(data: {
  reporterId: number;
  targetType: "user" | "post" | "comment";
  targetId: number;
  reason: string;
  description?: string | null;
}) {
  return prisma.report.create({ data: data as Prisma.ReportUncheckedCreateInput });
}

export function findById(id: number) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      assignedTo: { select: { id: true, username: true, displayName: true } },
      resolvedBy: { select: { id: true, username: true, displayName: true } },
    },
  });
}

export function findMany(
  where: Prisma.ReportWhereInput,
  orderBy: Prisma.ReportOrderByWithRelationInput | Prisma.ReportOrderByWithRelationInput[],
  opts: { skip: number; take: number },
) {
  return prisma.report.findMany({
    where,
    orderBy,
    include: {
      reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      assignedTo: { select: { id: true, username: true, displayName: true } },
    },
    ...opts,
  });
}

export function count(where: Prisma.ReportWhereInput) {
  return prisma.report.count({ where });
}

export function findByTarget(
  targetType: "user" | "post" | "comment",
  targetId: number,
  opts: { skip: number; take: number; excludeId?: number },
) {
  return prisma.report.findMany({
    where: { targetType, targetId, ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}) },
    orderBy: { createdAt: "desc" },
    include: { reporter: { select: { id: true, username: true, displayName: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countByTarget(targetType: "user" | "post" | "comment", targetId: number, excludeId?: number) {
  return prisma.report.count({ where: { targetType, targetId, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export function update(id: number, data: Prisma.ReportUncheckedUpdateInput) {
  return prisma.report.update({ where: { id }, data });
}
