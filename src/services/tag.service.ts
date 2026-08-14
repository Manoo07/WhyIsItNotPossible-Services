import { Prisma } from "@prisma/client";
import * as tagDao from "../dao/tag.dao.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

export async function list(limit?: number) {
  const tags = await tagDao.findMany({ limit });
  return tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug, postCount: t._count.postTags }));
}

export async function create(data: Prisma.TagCreateInput) {
  try {
    const tag = await tagDao.create(data);
    return { ...tag, postCount: 0 };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ConflictError("A tag with that name or slug already exists");
    }
    throw e;
  }
}

export async function update(id: number, data: Prisma.TagUpdateInput) {
  try {
    const tag = await tagDao.update(id, data);
    return { ...tag, postCount: 0 };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") throw new NotFoundError("Tag not found");
      if (e.code === "P2002") throw new ConflictError("A tag with that name or slug already exists");
    }
    throw e;
  }
}

export async function remove(id: number) {
  await tagDao.remove(id);
}
