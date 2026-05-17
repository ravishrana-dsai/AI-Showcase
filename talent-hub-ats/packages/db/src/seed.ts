import { PrismaClient } from "@prisma/client";
import pkg from "bcryptjs";
const { hash } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── 1. [Company] AI org (live — Ravish only) ────────────────────────────
  const companyOrg = await prisma.organization.upsert({
    where: { slug: "company" },
    update: { name: "[Company] AI" },
    create: {
      name: "[Company] AI",
      slug: "company",
      industry: "Technology",
      size: "51-200",
      website: "https://company.com",
      settings: JSON.stringify({ timezone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY" }),
    },
  });
  console.log(`  Org: ${companyOrg.name} (slug: ${companyOrg.slug})`);

  // ── 2. Demo org (separate — demo accounts only) ──────────────────────────
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: { name: "Demo Organization" },
    create: {
      name: "Demo Organization",
      slug: "demo",
      industry: "Technology",
      size: "1-10",
      website: "https://company.com",
      settings: JSON.stringify({ timezone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY" }),
    },
  });
  console.log(`  Org: ${demoOrg.name} (slug: ${demoOrg.slug})`);

  // ── 3. Users ─────────────────────────────────────────────────────────────
  const demoPw = await hash("Sports@123", 12);
  const adminPw = await hash("portal@123", 12);

  async function upsertUser(
    email: string,
    name: string,
    role: string,
    title: string,
    password: string,
    orgId: string
  ) {
    return prisma.user.upsert({
      where: { email },
      update: { name, title, role, organizationId: orgId, passwordHash: password },
      create: {
        email,
        name,
        passwordHash: password,
        role,
        title,
        organizationId: orgId,
        emailVerified: new Date(),
        isActive: true,
      },
    });
  }

  // Live Super Admin — [Company] AI org
  await upsertUser(
    "ravish.rana@dream11.com",
    "Ravish Rana",
    "SUPER_ADMIN",
    "Head of Talent",
    adminPw,
    companyOrg.id
  );

  // Demo accounts — separate Demo org (not visible in [Company] AI team settings)
  await upsertUser(
    "recruiter@company.com",
    "Bhanvi Kumar",
    "RECRUITER",
    "Senior Recruiter",
    demoPw,
    demoOrg.id
  );
  await upsertUser(
    "manager@company.com",
    "Arjun Mehta",
    "HIRING_MANAGER",
    "Engineering Manager",
    demoPw,
    demoOrg.id
  );
  await upsertUser(
    "interviewer@company.com",
    "Neha Gupta",
    "INTERVIEWER",
    "Staff Engineer",
    demoPw,
    demoOrg.id
  );

  console.log("  4 users ready (1 live + 3 demo)\n");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("Seed completed successfully!\n");
  console.log("Login credentials:\n");
  console.log("  SUPER ADMIN ([Company] AI org)");
  console.log("    ravish.rana@dream11.com     — Ravish Rana  password: portal@123\n");
  console.log("  DEMO ACCOUNTS (Demo org, password: Sports@123)");
  console.log("    recruiter@company.com   — Bhanvi Kumar (Recruiter)");
  console.log("    manager@company.com     — Arjun Mehta  (Hiring Manager)");
  console.log("    interviewer@company.com — Neha Gupta   (Interviewer)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
