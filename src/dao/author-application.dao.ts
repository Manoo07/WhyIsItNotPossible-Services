import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function create(data: Prisma.AuthorApplicationUncheckedCreateInput) {
  return prisma.authorApplication.create({ data });
}

export function findLatestByApplicant(applicantId: number) {
  return prisma.authorApplication.findFirst({
    where: { applicantId },
    orderBy: { createdAt: "desc" },
  });
}

export function findPendingByApplicant(applicantId: number) {
  return prisma.authorApplication.findFirst({
    where: { applicantId, status: "pending" },
  });
}

export function findById(id: number) {
  return prisma.authorApplication.findUnique({
    where: { id },
    include: { applicant: true, reviewedBy: true },
  });
}

export function findMany(
  where: Prisma.AuthorApplicationWhereInput,
  opts: { skip: number; take: number },
) {
  return prisma.authorApplication.findMany({
    where,
    include: { applicant: true },
    orderBy: { createdAt: "asc" },
    ...opts,
  });
}

export function count(where: Prisma.AuthorApplicationWhereInput) {
  return prisma.authorApplication.count({ where });
}

export function update(id: number, data: Prisma.AuthorApplicationUncheckedUpdateInput) {
  return prisma.authorApplication.update({ where: { id }, data });
}
