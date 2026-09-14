import * as postDao from "../dao/post.dao.js";
import * as categoryDao from "../dao/category.dao.js";

// Keep in sync with the static (non-/blog, non-parameterized) top-level
// <Route> paths in apps/blog/src/App.tsx that are meant to be public/indexable.
const STATIC_PATHS = ["/", "/about", "/contact", "/privacy", "/terms"];

function siteUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export async function buildSitemapXml(): Promise<string> {
  const base = siteUrl();
  const [posts, categories] = await Promise.all([
    postDao.findManyList({ status: "published", removedAt: null }, { publishedAt: "desc" }),
    categoryDao.findMany(),
  ]);

  const urls: Array<{ loc: string; lastmod?: string }> = [
    ...STATIC_PATHS.map((path) => ({ loc: `${base}${path}` })),
    ...categories.map((category) => ({ loc: `${base}/category/${category.slug}` })),
    ...posts.map((post) => ({
      loc: `${base}/blog/${post.slug}`,
      lastmod: (post.updatedAt ?? post.publishedAt)?.toISOString().slice(0, 10),
    })),
  ];

  const body = urls
    .map(({ loc, lastmod }) =>
      lastmod
        ? `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
        : `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
