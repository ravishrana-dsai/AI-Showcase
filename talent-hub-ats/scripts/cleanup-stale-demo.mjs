/**
 * Removes stale demo/test accounts that are not part of the official seed.
 * Run once after npm run db:seed when migrating org structure.
 */
import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";

const prisma = new PrismaClient();

const KEEP_EMAILS = new Set([
  "ravish.rana@dream11.com",
  "recruiter@dreamplayai.com",
  "manager@dreamplayai.com",
  "interviewer@dreamplayai.com",
]);

const STALE_EMAILS = [
  "admin@dreamplayai.com",
  "ravish.rana@dreamplayai.com",
];

async function main() {
  console.log("Cleaning up stale demo accounts...\n");

  for (const email of STALE_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.delete({ where: { email } });
      console.log(`  Deleted: ${email}`);
    } else {
      console.log(`  Not found (skipped): ${email}`);
    }
  }

  // Safety check: list remaining users
  const remaining = await prisma.user.findMany({
    select: { email: true, role: true, organizationId: true },
    orderBy: { email: "asc" },
  });

  console.log("\nRemaining users in DB:");
  for (const u of remaining) {
    const marker = KEEP_EMAILS.has(u.email) ? "✓" : "⚠ UNEXPECTED";
    console.log(`  ${marker}  ${u.email}  (${u.role})`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
