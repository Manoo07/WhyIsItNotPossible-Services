import * as postDao from "../dao/post.dao.js";
import * as likeDao from "../dao/like.dao.js";
import * as userDao from "../dao/user.dao.js";
import * as categoryDao from "../dao/category.dao.js";

export async function getStats() {
  const [totalPosts, viewsAgg, totalLikes, totalAuthors, categories] = await Promise.all([
    postDao.count({ status: "published" }),
    postDao.sumViewCount({ status: "published" }),
    likeDao.countAll(),
    userDao.count({ role: { in: ["owner", "author"] } }),
    categoryDao.findMany(),
  ]);

  const categoryBreakdown = await Promise.all(
    categories.map(async (c) => {
      const count = await postDao.count({ categoryId: c.id, status: "published" });
      return { name: c.name, slug: c.slug, count };
    }),
  );

  return {
    totalPosts,
    totalViews: viewsAgg._sum.viewCount ?? 0,
    totalLikes,
    totalAuthors,
    categoryBreakdown,
  };
}
