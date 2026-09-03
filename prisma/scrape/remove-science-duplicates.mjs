// One-off cleanup: run.mjs science created these 12 as NEW posts (their
// slug changed on the live site since the original import), duplicating
// the 12 old-slug posts that refresh-science.mjs just fixed in place. The
// old-slug versions are what's actually been live/linkable on this site,
// so those are kept; these new-slug duplicates are removed.
//
// Prints each post's engagement (likes/comments/bookmarks) before deleting
// so nothing meaningful is silently discarded.
//
// Usage: node prisma/scrape/remove-science-duplicates.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DUPLICATE_SLUGS = [
  "why-cant-humans-run-100-kmh",
  "why-cant-humans-live-for-200-years",
  "hack-the-human-brain-like-a-computer",
  "why-we-cant-see-the-entire-universe",
  "why-cameras-cannot-capture-the-world",
  "why-landing-on-the-sun-is-impossible",
  "solar-panel-efficiency-100-percent-impossible",
  "why-impossible-remember-every-moment-life",
  "100-percent-of-fuel-energy-into-work",
  "why-true-multitasking-is-not-possible",
  "faster-than-light-travel-impossible",
  "why-flying-like-superheroes-is-impossible",
];

async function main() {
  let deleted = 0;
  let skipped = 0;

  for (const slug of DUPLICATE_SLUGS) {
    const post = await prisma.post.findUnique({
      where: { slug },
      include: { _count: { select: { likes: true, comments: true, bookmarks: true } } },
    });
    if (!post) {
      skipped++;
      console.log(`- not found (already gone?): ${slug}`);
      continue;
    }
    const { likes, comments, bookmarks } = post._count;
    console.log(
      `~ deleting: ${post.title} (${slug}) — ${likes} likes, ${comments} comments, ${bookmarks} bookmarks, ${post.viewCount} views`,
    );
    await prisma.post.delete({ where: { id: post.id } });
    deleted++;
  }

  console.log(`\nDone. Deleted ${deleted}, skipped ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
