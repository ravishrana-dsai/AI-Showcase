/**
 * Purge all stale demo/test users and their related data.
 * Uses Prisma transactions to cascade-delete in correct order.
 */
import { PrismaClient } from "../packages/db/node_modules/@prisma/client/index.js";

const prisma = new PrismaClient();

const KEEP_EMAILS = [
  "ravish.rana@dream11.com",
  "recruiter@dreamplayai.com",
  "manager@dreamplayai.com",
  "interviewer@dreamplayai.com",
];

async function main() {
  const all = await prisma.user.findMany({ select: { id: true, email: true } });
  const stale = all.filter((u) => !KEEP_EMAILS.includes(u.email));
  const ids = stale.map((u) => u.id);

  if (ids.length === 0) {
    console.log("No stale users found.");
    return;
  }

  console.log("Purging stale users:", stale.map((u) => u.email));

  // Delete in dependency order inside a transaction
  await prisma.$transaction(async (tx) => {
    await tx.scorecard.deleteMany({ where: { reviewerId: { in: ids } } });
    await tx.interviewPanelist.deleteMany({ where: { userId: { in: ids } } });
    await tx.notification.deleteMany({ where: { userId: { in: ids } } });

    // Delete applications referencing stale users as HM or recruiter
    const staleCandidates = await tx.candidate.findMany({
      where: { organizationId: { notIn: [] } }, // placeholder
      select: { id: true },
    });

    // Find and delete applications via jobs that belong to stale orgs (not dreamplayai or demo)
    const staleOrgIds = await tx.organization
      .findMany({
        where: { slug: { notIn: ["dreamplayai", "demo"] } },
        select: { id: true },
      })
      .then((orgs) => orgs.map((o) => o.id));

    if (staleOrgIds.length > 0) {
      await tx.scorecard.deleteMany({
        where: {
          application: { job: { organizationId: { in: staleOrgIds } } },
        },
      });
      await tx.offer.deleteMany({
        where: {
          application: { job: { organizationId: { in: staleOrgIds } } },
        },
      });
      await tx.interviewPanelist.deleteMany({
        where: {
          interview: {
            application: { job: { organizationId: { in: staleOrgIds } } },
          },
        },
      });
      await tx.interview.deleteMany({
        where: {
          application: { job: { organizationId: { in: staleOrgIds } } },
        },
      });
      await tx.application.deleteMany({
        where: { job: { organizationId: { in: staleOrgIds } } },
      });
      await tx.candidate.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await tx.job.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await tx.department.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await tx.pipelineTemplate.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await tx.user.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await tx.organization.deleteMany({
        where: { id: { in: staleOrgIds } },
      });
    }

    // Finally delete any remaining stale users
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });

  const remaining = await prisma.user.findMany({
    select: { email: true, role: true },
  });
  console.log("\nRemaining users:");
  for (const u of remaining) {
    console.log(`  ${u.email} (${u.role})`);
  }

  const orgs = await prisma.organization.findMany({ select: { name: true, slug: true } });
  console.log("\nRemaining orgs:");
  for (const o of orgs) {
    console.log(`  ${o.name} (${o.slug})`);
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
