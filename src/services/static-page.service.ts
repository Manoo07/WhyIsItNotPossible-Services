import { Prisma } from "@prisma/client";
import * as staticPageDao from "../dao/static-page.dao.js";
import { sanitizeHtml } from "../lib/sanitize.js";
import { NotFoundError } from "../lib/errors.js";

export function list() {
  return staticPageDao.findMany();
}

export async function getBySlug(slug: string) {
  const page = await staticPageDao.findBySlug(slug);
  if (!page) {
    throw new NotFoundError("Page not found");
  }
  return page;
}

export async function update(slug: string, data: { title?: string; content?: string }) {
  const patch: Prisma.StaticPageUpdateInput = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.content !== undefined) patch.content = sanitizeHtml(data.content);

  try {
    return await staticPageDao.update(slug, patch);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Page not found");
    }
    throw e;
  }
}
