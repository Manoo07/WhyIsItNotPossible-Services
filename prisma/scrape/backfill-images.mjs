// One-off backfill: for posts that already exist in the DB but have no
// coverImageUrl (e.g. the original seed-science.mjs posts, which never
// captured one), re-fetch just the live page's thumbnail image and patch
// that single field in — title/content/tags are left untouched since
// those already exist.
//
// Usage: node prisma/scrape/backfill-images.mjs
import { PrismaClient } from "@prisma/client";
import { fetchArticle } from "./parse.mjs";

const prisma = new PrismaClient();

async function main() {
  const missing = await prisma.post.findMany({
    where: { coverImageUrl: null },
    select: { id: true, slug: true, title: true },
  });
  console.log(`Found ${missing.length} post(s) missing a cover image.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of missing) {
    const url = `https://whyisitnotpossible.com/${post.slug}/`;
    try {
      const article = await fetchArticle(url);
      if (!article.coverImageUrl) {
        skipped++;
        console.log(`- no image on live page: ${post.title}`);
        continue;
      }
      await prisma.post.update({ where: { id: post.id }, data: { coverImageUrl: article.coverImageUrl } });
      updated++;
      console.log(`+ backfilled: ${post.title}`);
    } catch (err) {
      failed++;
      console.error(`! could not fetch ${url} (likely slug doesn't match a live page): ${post.title}\n  ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped} (no image found), failed ${failed} (fetch error).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
