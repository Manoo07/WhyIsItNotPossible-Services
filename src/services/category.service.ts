import { Prisma } from "@prisma/client";
import * as categoryDao from "../dao/category.dao.js";
import * as postDao from "../dao/post.dao.js";
import { NotFoundError } from "../lib/errors.js";

export async function list() {
  const cats = await categoryDao.findMany();
  return Promise.all(
    cats.map(async (c) => {
      const count = await postDao.count({ categoryId: c.id });
      return { ...c, postCount: count };
    }),
  );
}

export async function create(data: Prisma.CategoryCreateInput) {
  const cat = await categoryDao.create(data);
  return { ...cat, postCount: 0 };
}

export async function update(id: number, data: Prisma.CategoryUpdateInput) {
  try {
    const cat = await categoryDao.update(id, data);
    return { ...cat, postCount: 0 };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Category not found");
    }
    throw e;
  }
}

export async function remove(id: number) {
  await categoryDao.remove(id);
}
