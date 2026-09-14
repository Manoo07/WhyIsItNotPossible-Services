// One-off maintenance script for the aftermath of the science/technology/
// sports/movies-music re-scrape (run.mjs --update against the live
// Hostinger preview site). That re-scrape matches existing posts by slug,
// but the live site's current URLs don't match the slugs already in the
// DB from the earlier dump restore (WordPress renamed some URLs at some
// point) — so instead of updating those posts in place, it created new
// ones under the new slugs, leaving the old truncated post (from the
// broken dump) sitting right alongside the new complete one.
//
// This does two things:
//
// 1. Dedupes. Groups posts by title (ignoring a trailing " – subtitle"
//    WordPress sometimes appends) and, within any group with more than
//    one post, keeps only the longest — the freshly-rescraped post is
//    always dramatically longer than the truncated leftover, so this is a
//    reliable way to tell them apart without hand-picking IDs.
//
// 2. Fixes internal links. The scraped "Related Reads" links are absolute
//    URLs to whatever WordPress considered its own domain at scrape time
//    (the temporary Hostinger preview URL, or the original domain) rather
//    than our own site. Rewrites any single-segment link on those hosts
//    to "/blog/:slug" when that post still exists here, or a bare "/:slug"
//    (which still 301s to /blog/:slug via the legacy-redirect nginx rule)
//    if it doesn't.
//
// Usage:
//   node prisma/scrape/cleanup-duplicates-and-links.mjs --dry-run
//   node prisma/scrape/cleanup-duplicates-and-links.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

// Domains whose internal links should be rewritten to point at our own
// site instead.
const FOREIGN_HOSTS = [
  "sandybrown-dotterel-689149.hostingersite.com",
  "whyisitnotpossible.com",
  "www.whyisitnotpossible.com",
];

function normalizeTitle(title) {
  return title.toLowerCase().trim().split(/\s[–—]\s/)[0].trim();
}

async function dedupe(posts) {
  const groups = new Map();
  for (const post of posts) {
    const key = normalizeTitle(post.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(post);
  }

  const toDelete = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.content.length - a.content.length);
    const [keep, ...rest] = sorted;
    console.log(`\nDuplicate group: "${key}"`);
    console.log(`  keep:   #${keep.id} ${keep.slug} (${keep.content.length} chars)`);
    for (const dup of rest) {
      console.log(`  delete: #${dup.id} ${dup.slug} (${dup.content.length} chars)`);
      toDelete.push(dup.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates found.");
    return [];
  }

  console.log(`\n${dryRun ? "[dry-run] Would delete" : "Deleting"} ${toDelete.length} duplicate post(s).`);
  if (!dryRun) {
    await prisma.post.deleteMany({ where: { id: { in: toDelete } } });
  }
  return toDelete;
}

async function fixLinks(survivingPosts) {
  const survivingSlugs = new Set(survivingPosts.map((p) => p.slug));
  const hostPattern = FOREIGN_HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|");
  const linkRegex = new RegExp(`href="https?://(?:${hostPattern})/([^"/?#]+)/?"`, "gi");

  let updated = 0;
  for (const post of survivingPosts) {
    let changed = false;
    const newContent = post.content.replace(linkRegex, (_full, slug) => {
      changed = true;
      return survivingSlugs.has(slug) ? `href="/blog/${slug}"` : `href="/${slug}"`;
    });
    if (changed) {
      updated++;
      console.log(`${dryRun ? "[dry-run] would fix" : "fixing"} links in #${post.id} ${post.slug}`);
      if (!dryRun) {
        await prisma.post.update({ where: { id: post.id }, data: { content: newContent } });
      }
    }
  }
  console.log(`\n${dryRun ? "Would update" : "Updated"} links in ${updated} post(s).`);
}

async function main() {
  const posts = await prisma.post.findMany({
    select: { id: true, slug: true, title: true, content: true },
  });
  const deletedIds = await dedupe(posts);
  const survivingPosts = posts.filter((p) => !deletedIds.includes(p.id));
  await fixLinks(survivingPosts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
