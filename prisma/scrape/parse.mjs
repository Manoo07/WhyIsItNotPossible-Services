// Parses a single whyisitnotpossible.com (WordPress + Kadence) article page
// into the shape our own Post schema wants. Structural selectors only —
// this file contains no article content itself.
import * as cheerio from "cheerio";

function slugFromUrl(url) {
  const path = new URL(url).pathname;
  return path.replace(/^\/|\/$/g, "");
}

export async function fetchArticle(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; site-migration-script/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $(".entry-title").first().text().trim();
  const subtitle = $('meta[name="description"]').attr("content")?.trim() || null;

  const tags = $(".entry-tags .tag-link")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const publishedAttr = $("time.entry-date.published").attr("datetime");
  const publishedAt = publishedAttr ? new Date(publishedAttr) : new Date();

  const coverImageUrl = $(".post-thumbnail-inner img").first().attr("src") || null;

  // Body: take the article's own content block only (excludes related-posts
  // carousels, nav, comments — those live outside .entry-content).
  const $content = $(".entry-content.single-content").first().clone();
  // Strip anything WordPress injects that isn't real article body (share
  // buttons, ad slots, embedded related-post blocks that sometimes land
  // inside entry-content on some themes).
  $content.find("script,style,.sharedaddy,.jp-relatedposts,.code-block").remove();
  const contentHtml = $content.html()?.trim() || "";

  if (!title || !contentHtml) {
    throw new Error(`Could not parse required fields from ${url} (title=${!!title}, content=${!!contentHtml})`);
  }

  return {
    url,
    slug: slugFromUrl(url),
    title,
    subtitle,
    tags,
    publishedAt,
    coverImageUrl,
    contentHtml,
  };
}
