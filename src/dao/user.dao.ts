import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export function findByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

export function findById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export function count(where?: Prisma.UserWhereInput) {
  return prisma.user.count({ where });
}

export function findMany(
  where: Prisma.UserWhereInput,
  orderBy: Prisma.UserOrderByWithRelationInput,
  opts: { skip: number; take: number },
) {
  return prisma.user.findMany({ where, orderBy, ...opts });
}

export function create(data: Prisma.UserCreateInput) {
  return prisma.user.create({ data });
}

export function update(id: number, data: Prisma.UserUpdateInput) {
  return prisma.user.update({ where: { id }, data });
}
