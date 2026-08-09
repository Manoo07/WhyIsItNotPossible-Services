import type { Request, Response } from "express";
import * as postService from "../services/post.service.js";
import * as statsService from "../services/stats.service.js";
import * as recommendationService from "../services/recommendation.service.js";
import * as commentService from "../services/comment.service.js";
import { CreatePostBody, UpdatePostBody, AutosavePostBody, CreateCommentBody } from "../lib/validation.js";
import { BadRequestError, NotFoundError } from "../lib/errors.js";

export async function list(req: Request, res: Response) {
  const page = parseInt(String(req.query.page ?? "1"));
  const limit = Math.min(parseInt(String(req.query.limit ?? "12")), 50);
  const search = String(req.query.search ?? "");
  const categorySlug = String(req.query.category ?? "");
  const tagSlug = String(req.query.tag ?? "");
  const status = String(req.query.status ?? "published");
  const authorId = req.query.authorId ? parseInt(String(req.query.authorId)) : null;
  const sort = String(req.query.sort ?? "newest");

  res.json(
    await postService.list({
      page,
      limit,
      search,
      categorySlug,
      tagSlug,
      status,
      authorId,
      sort,
      userId: req.session?.user?.id,
    }),
  );
}

export async function featured(req: Request, res: Response) {
  const limit = Math.min(parseInt(String(req.query.limit ?? "5")), 10);
  res.json(await postService.getFeatured(limit, req.session?.user?.id));
}

export async function trending(req: Request, res: Response) {
  const limit = Math.min(parseInt(String(req.query.limit ?? "6")), 12);
  res.json(await postService.getTrending(limit, req.session?.user?.id));
}

export async function stats(_req: Request, res: Response) {
  res.json(await statsService.getStats());
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    throw new NotFoundError("Post not found");
  }
  res.json(await postService.getById(id, req.session?.user?.id));
}

export async function getBySlug(req: Request<{ slug: string }>, res: Response) {
  res.json(await postService.getBySlug(req.params.slug, req.session?.user?.id));
}

export async function create(req: Request, res: Response) {
  const body = CreatePostBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.status(201).json(await postService.create(req.session.user!, body.data));
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  const body = UpdatePostBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await postService.update(id, req.session.user!, body.data));
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  await postService.remove(id, req.session.user!);
  res.json({ success: true });
}

export async function autosave(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  const body = AutosavePostBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.json(await postService.autosave(id, req.session.user!, body.data));
}

export async function like(req: Request<{ id: string }>, res: Response) {
  const postId = parseInt(req.params.id);
  res.json(await postService.toggleLike(postId, req.session.user!.id));
}

export async function bookmark(req: Request<{ id: string }>, res: Response) {
  const postId = parseInt(req.params.id);
  res.json(await postService.toggleBookmark(postId, req.session.user!.id));
}

export async function related(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  const limit = Math.min(parseInt(String(req.query.limit ?? "8")), 24);
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  res.json(await recommendationService.getRelated(id, page, limit, req.session?.user?.id));
}

export async function listComments(req: Request<{ id: string }>, res: Response) {
  const postId = parseInt(req.params.id);
  const page = Math.max(parseInt(String(req.query.page ?? "1")), 1);
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);
  res.json(await commentService.listComments(postId, page, limit));
}

export async function addComment(req: Request<{ id: string }>, res: Response) {
  const postId = parseInt(req.params.id);
  const userId = req.session.user!.id;
  const body = CreateCommentBody.safeParse(req.body);
  if (!body.success) {
    throw new BadRequestError();
  }
  res.status(201).json(await commentService.addComment(postId, userId, body.data));
}

export async function removeComment(req: Request<{ id: string }>, res: Response) {
  const id = parseInt(req.params.id);
  await commentService.removeComment(id, req.session.user!);
  res.json({ success: true });
}
