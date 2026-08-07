import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findMany() {
  return prisma.category.findMany();
}

export function findBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export function findById(id: number) {
  return prisma.category.findUnique({ where: { id } });
}

export function create(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export function update(id: number, data: Prisma.CategoryUpdateInput) {
  return prisma.category.update({ where: { id }, data });
}

export function remove(id: number) {
  return prisma.category.deleteMany({ where: { id } });
}
