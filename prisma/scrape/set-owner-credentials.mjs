// One-off: points the existing "owner" user (created as a placeholder to
// attribute scraped posts to — see run.mjs) at a real email/password so
// you can actually log in as them. Bypasses the normal registration/OTP
// flow entirely since this runs with direct DB access, not through the
// public signup endpoint.
//
// Usage:
//   node prisma/scrape/set-owner-credentials.mjs you@example.com 'your-new-password'
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: node prisma/scrape/set-owner-credentials.mjs <email> <password>");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const owner = await prisma.user.findFirst({ where: { role: "owner" } });
  if (!owner) {
    throw new Error('No user with role "owner" found — nothing to update.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({
    where: { id: owner.id },
    data: {
      email,
      passwordHash,
      // Login is blocked without this — set it if it isn't already, since
      // this bypasses the normal email-verification flow on purpose.
      emailVerifiedAt: owner.emailVerifiedAt ?? new Date(),
    },
  });

  console.log(`Updated owner #${updated.id} (username: ${updated.username}) — email is now ${updated.email}.`);
  console.log("You can log in with that email and the password you just set.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
