import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Delete jobs created by E2E (title "E2E Job <timestamp>")
  const e2eJobs = await prisma.job.findMany({
    where: { title: { startsWith: "E2E Job " } },
    select: { id: true, title: true },
  });
  if (e2eJobs.length > 0) {
    await prisma.job.deleteMany({ where: { title: { startsWith: "E2E Job " } } });
    console.log(`Removed ${e2eJobs.length} E2E job(s): ${e2eJobs.map((j) => j.title).join(", ")}`);
  } else {
    console.log("No E2E jobs found.");
  }

  // 2. Delete candidates created by E2E (E2EFirst E2ELast, email e2e-*@example.com)
  const e2eCandidates = await prisma.candidate.findMany({
    where: {
      firstName: "E2EFirst",
      lastName: "E2ELast",
      email: { contains: "@example.com" },
    },
    select: { id: true, email: true },
  });
  if (e2eCandidates.length > 0) {
    await prisma.candidate.deleteMany({
      where: {
        firstName: "E2EFirst",
        lastName: "E2ELast",
        email: { contains: "@example.com" },
      },
    });
    console.log(`Removed ${e2eCandidates.length} E2E candidate(s): ${e2eCandidates.map((c) => c.email).join(", ")}`);
  } else {
    console.log("No E2E candidates found.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
