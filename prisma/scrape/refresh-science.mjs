// One-off fix: the 17 Science posts were originally hand-typed/paraphrased
// into seed-science.mjs instead of being scraped from the live site, so they
// were missing large chunks of the real article (whole sections, in some
// cases). This re-fetches each one from its CURRENT live URL — most slugs
// were shortened on whyisitnotpossible.com after the original import — and
// overwrites content/subtitle/excerpt/cover/tags in place via the same
// parse/sanitize pipeline the other categories already use correctly.
//
// The DB row is matched by its EXISTING (old) slug, not the new URL's slug,
// so the post id/slug/title/publishedAt/category are untouched — no links
// break.
//
// Usage: node prisma/scrape/refresh-science.mjs
import { PrismaClient } from "@prisma/client";
import { fetchArticle } from "./parse.mjs";
import { sanitizeHtml } from "./sanitize.mjs";

const prisma = new PrismaClient();

function estimateReadingTime(htmlContent) {
  const text = htmlContent.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

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

// oldSlug (what's already in our DB) -> current live URL
const REMAP = {
  "why-humans-cannot-survive-without-sleep": "https://whyisitnotpossible.com/why-humans-cannot-survive-without-sleep/",
  "why-cant-humans-run-100-kmh-the-biological-and-physics-limits-explained": "https://whyisitnotpossible.com/why-cant-humans-run-100-kmh/",
  "why-cant-humans-see-infrared-or-ultraviolet": "https://whyisitnotpossible.com/why-cant-humans-see-infrared-or-ultraviolet/",
  "why-cant-humans-live-for-200-years-biological-limits-of-lifespan": "https://whyisitnotpossible.com/why-cant-humans-live-for-200-years/",
  "why-time-travel-to-the-past-is-probably-impossible": "https://whyisitnotpossible.com/why-time-travel-to-the-past-is-probably-impossible/",
  "why-we-cant-hack-the-human-brain-like-a-computer": "https://whyisitnotpossible.com/hack-the-human-brain-like-a-computer/",
  "why-we-cant-see-the-entire-universe-the-science-behind-the-observable-universe": "https://whyisitnotpossible.com/why-we-cant-see-the-entire-universe/",
  "why-cameras-cannot-capture-the-world-exactly-as-human-eyes-see-it": "https://whyisitnotpossible.com/why-cameras-cannot-capture-the-world/",
  "why-humans-cant-survive-on-mars-without-domes": "https://whyisitnotpossible.com/why-humans-cant-survive-on-mars-without-domes/",
  "why-landing-on-the-sun-is-impossible-the-physics-and-heat-explained": "https://whyisitnotpossible.com/why-landing-on-the-sun-is-impossible/",
  "why-solar-panels-can-never-convert-100-of-sunlight-into-electricity": "https://whyisitnotpossible.com/solar-panel-efficiency-100-percent-impossible/",
  "why-we-cant-remember-every-moment-of-our-life": "https://whyisitnotpossible.com/why-impossible-remember-every-moment-life/",
  "why-no-engine-can-convert-100-of-fuel-energy-into-work": "https://whyisitnotpossible.com/100-percent-of-fuel-energy-into-work/",
  "why-you-cant-truly-multitask-and-what-your-brain-does-instead": "https://whyisitnotpossible.com/why-true-multitasking-is-not-possible/",
  "why-teleportation-is-impossible": "https://whyisitnotpossible.com/why-teleportation-is-impossible/",
  "why-faster-than-light-travel-is-probably-impossible": "https://whyisitnotpossible.com/faster-than-light-travel-impossible/",
  "why-flying-like-superheroes-is-physically-impossible": "https://whyisitnotpossible.com/why-flying-like-superheroes-is-impossible/",
};

async function main() {
  let updated = 0;
  let failed = 0;

  for (const [oldSlug, liveUrl] of Object.entries(REMAP)) {
    const existing = await prisma.post.findUnique({ where: { slug: oldSlug } });
    if (!existing) {
      failed++;
      console.error(`! no existing post for slug: ${oldSlug}`);
      continue;
    }

    let article;
    try {
      article = await fetchArticle(liveUrl);
    } catch (err) {
      failed++;
      console.error(`! fetch/parse failed: ${liveUrl}\n  ${err.message}`);
      continue;
    }

    const content = sanitizeHtml(article.contentHtml);
    const readingTime = estimateReadingTime(content);

    await prisma.post.update({
      where: { id: existing.id },
      data: {
        subtitle: article.subtitle,
        content,
        excerpt: article.subtitle,
        coverImageUrl: article.coverImageUrl,
        readingTime,
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
        where: { postId_tagId: { postId: existing.id, tagId: tag.id } },
        update: {},
        create: { postId: existing.id, tagId: tag.id },
      });
    }

    updated++;
    console.log(
      `~ refreshed: ${existing.slug} (${existing.content.length} -> ${content.length} chars, ${readingTime} min read)`,
    );
  }

  console.log(`\nDone. Refreshed ${updated}, failed ${failed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
