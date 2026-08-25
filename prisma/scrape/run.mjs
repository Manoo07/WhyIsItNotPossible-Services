// Generic importer: reads a manifest (prisma/scrape/manifests/*.mjs), fetches
// each URL from whyisitnotpossible.com, and writes it in as a Post under the
// given category — same DB-write shape as the existing seed-science.mjs.
//
// By default, a URL whose post already exists (matched by slug) is left
// alone. Pass --update to instead re-fetch and overwrite that post's
// content/subtitle/excerpt/cover/tags with what's live on the site now —
// e.g. to backfill embeds/links into posts imported before sanitizeHtml()
// allowed iframes. Title/slug/publishedAt/author/category are never
// touched by --update, so URLs and ordering don't move.
//
// Usage:
//   node prisma/scrape/run.mjs technology
//   node prisma/scrape/run.mjs sports --limit=5
//   node prisma/scrape/run.mjs sports --update
import { PrismaClient } from "@prisma/client";
import { fetchArticle } from "./parse.mjs";
import { sanitizeHtml } from "./sanitize.mjs";

const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function estimateReadingTime(htmlContent) {
  const text = htmlContent.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function main() {
  const manifestName = process.argv[2];
  if (!manifestName) {
    console.error("Usage: node prisma/scrape/run.mjs <manifest-name> [--limit=N]");
    process.exitCode = 1;
    return;
  }
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const updateExisting = process.argv.includes("--update");

  const { categoryMeta, urls } = await import(`./manifests/${manifestName}.mjs`);

  // Looked up by role, not a specific email — the site's owner account is
  // what these imports should be attributed to, and that account's email
  // has already changed once (from the original phase0@test.local
  // placeholder to a real address), which is exactly the kind of thing a
  // hardcoded email match breaks on silently.
  const author = await prisma.user.findFirst({ where: { role: "owner" } });
  if (!author) {
    throw new Error("No user with role \"owner\" found — create/promote one first.");
  }

  const category = await prisma.category.upsert({
    where: { slug: categoryMeta.slug },
    update: {},
    create: categoryMeta,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const url of urls.slice(0, limit)) {
    let article;
    try {
      article = await fetchArticle(url);
    } catch (err) {
      failed++;
      console.error(`! fetch/parse failed: ${url}\n  ${err.message}`);
      continue;
    }

    const slug = article.slug || slugify(article.title);
    const existing = await prisma.post.findUnique({ where: { slug } });

    if (existing && !updateExisting) {
      skipped++;
      console.log(`- skip (already exists): ${article.title}`);
      continue;
    }

    const content = sanitizeHtml(article.contentHtml);
    const readingTime = estimateReadingTime(content);

    const post = existing
      ? await prisma.post.update({
          where: { id: existing.id },
          data: {
            subtitle: article.subtitle,
            content,
            excerpt: article.subtitle,
            coverImageUrl: article.coverImageUrl,
            readingTime,
          },
        })
      : await prisma.post.create({
          data: {
            title: article.title,
            subtitle: article.subtitle,
            slug,
            content,
            excerpt: article.subtitle,
            coverImageUrl: article.coverImageUrl,
            status: "published",
            authorId: author.id,
            categoryId: category.id,
            readingTime,
            publishedAt: article.publishedAt,
            createdAt: article.publishedAt,
            updatedAt: article.publishedAt,
          },
        });

    for (const tagName of article.tags) {
      const tagSlug = slugify(tagName);
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: { name: tagName, slug: tagSlug },
      });
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId: post.id, tagId: tag.id } },
        update: {},
        create: { postId: post.id, tagId: tag.id },
      });
    }

    if (existing) {
      updated++;
      console.log(`~ updated: ${article.title} (${readingTime} min read, ${article.tags.length} tags)`);
    } else {
      created++;
      console.log(`+ created: ${article.title} (${readingTime} min read, ${article.tags.length} tags)`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
