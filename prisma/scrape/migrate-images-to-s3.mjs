// One-off migration: posts whose coverImageUrl still points at the
// original whyisitnotpossible.com WordPress uploads get that image
// downloaded and re-uploaded to this app's own S3 bucket, then the DB
// record is updated to point at the new S3 URL. Mirrors the exact
// key convention upload.service.ts uses for normal uploads (posts/<ts>-
// <random>.<ext>) so migrated and freshly-uploaded images are
// indistinguishable in storage.
//
// Usage: node --env-file=.env prisma/scrape/migrate-images-to-s3.mjs [--dry-run]
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set (check .env)`);
  return v;
}

function buildObjectKey(sourceUrl) {
  const ext = path.extname(new URL(sourceUrl).pathname) || ".jpg";
  return `posts/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
}

async function main() {
  const region = requireEnv("AWS_REGION");
  const bucket = requireEnv("AWS_S3_BUCKET");
  requireEnv("AWS_ACCESS_KEY_ID");
  requireEnv("AWS_SECRET_ACCESS_KEY");
  const s3 = new S3Client({ region });

  const posts = await prisma.post.findMany({
    where: { coverImageUrl: { not: null } },
    select: { id: true, title: true, coverImageUrl: true },
  });
  const toMigrate = posts.filter((p) => !p.coverImageUrl.includes("amazonaws.com"));
  console.log(`${toMigrate.length} post(s) with a non-S3 cover image to migrate.${dryRun ? " (dry run — no writes)" : ""}\n`);

  let migrated = 0;
  let failed = 0;

  for (const post of toMigrate) {
    try {
      const res = await fetch(post.coverImageUrl);
      if (!res.ok) throw new Error(`GET ${post.coverImageUrl} -> ${res.status}`);
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());

      const key = buildObjectKey(post.coverImageUrl);
      const newUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      if (!dryRun) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          }),
        );
        await prisma.post.update({ where: { id: post.id }, data: { coverImageUrl: newUrl } });
      }

      migrated++;
      console.log(`+ ${dryRun ? "would migrate" : "migrated"}: ${post.title} (${(buffer.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      failed++;
      console.error(`! failed: ${post.title}\n  ${err.message}`);
    }
  }

  console.log(`\nDone. ${dryRun ? "Would migrate" : "Migrated"} ${migrated}, failed ${failed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
