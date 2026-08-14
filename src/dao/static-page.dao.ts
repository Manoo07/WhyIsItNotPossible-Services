import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findMany() {
  return prisma.staticPage.findMany({ orderBy: { slug: "asc" } });
}

export function findBySlug(slug: string) {
  return prisma.staticPage.findUnique({ where: { slug } });
}

export function update(slug: string, data: Prisma.StaticPageUpdateInput) {
  return prisma.staticPage.update({ where: { slug }, data });
}
