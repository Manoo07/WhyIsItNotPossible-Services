import * as postDao from "../dao/post.dao.js";
import * as tagDao from "../dao/tag.dao.js";
import { enrichPost } from "./post.service.js";

// Ranks candidate posts by how many tags they share with the source post
// (the strongest signal — two posts about the same specific things) plus a
// same-category bonus and a small popularity tiebreaker, rather than just
// "same category, most viewed" — a post could be in a different category
// entirely and still be the more relevant read if it shares three tags.
const RELATED_TAG_WEIGHT = 3;
const RELATED_CATEGORY_WEIGHT = 2;

// Scores every other published post rather than pre-filtering to a small
// candidate pool — the pool is small enough (a personal blog, not a
// platform-scale catalog) that this is cheap, and it means "View More"
// pagination can page all the way through the entire catalog, ranked most-
// to least relevant, instead of running out after one small pre-filtered
// batch.
export async function getRelated(id: number, page: number, pageSize: number, userId?: number) {
  const post = await postDao.findById(id);
  if (!post) {
    return { posts: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const ownTags = await tagDao.findPostTagsByPost(id);
  const ownTagIds = ownTags.map((pt) => pt.tagId);

  const sharedTagCounts = new Map<number, number>();
  if (ownTagIds.length > 0) {
    const rows = await tagDao.findPostTagsForTagIds(ownTagIds, id);
    for (const { postId } of rows) {
      sharedTagCounts.set(postId, (sharedTagCounts.get(postId) ?? 0) + 1);
    }
  }

  const allOthers = await postDao.findMany({ status: "published", removedAt: null, id: { not: id } }, { viewCount: "desc" });

  const ranked = allOthers
    .map((p) => {
      const tagScore = (sharedTagCounts.get(p.id) ?? 0) * RELATED_TAG_WEIGHT;
      const categoryScore = post.categoryId && p.categoryId === post.categoryId ? RELATED_CATEGORY_WEIGHT : 0;
      const popularityScore = Math.log10(p.viewCount + 1) * 0.5;
      return { post: p, score: tagScore + categoryScore + popularityScore };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.post);

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSlice = ranked.slice((page - 1) * pageSize, page * pageSize);

  return {
    posts: await Promise.all(pageSlice.map((p) => enrichPost(p, userId))),
    total,
    page,
    pageSize,
    totalPages,
  };
}
