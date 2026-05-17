import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo interview data...");

  // Find demo org
  const org = await prisma.organization.findUnique({ where: { slug: "demo" } });
  if (!org) throw new Error("Demo org not found. Run the main seed first.");

  // Find users
  const recruiter = await prisma.user.findUnique({ where: { email: "recruiter@company.com" } });
  const interviewer = await prisma.user.findUnique({ where: { email: "interviewer@company.com" } });
  const manager = await prisma.user.findUnique({ where: { email: "manager@company.com" } });
  if (!recruiter || !interviewer || !manager) throw new Error("Demo users not found. Run the main seed first.");

  // Create job with scoring criteria
  const existingJob = await prisma.job.findFirst({ where: { organizationId: org.id, slug: "senior-frontend-engineer" } });
  const job = existingJob ?? await prisma.job.create({
    data: {
      title: "Senior Frontend Engineer",
      slug: "senior-frontend-engineer",
      description: "We are looking for a senior frontend engineer to join our team.",
      requirements: "5+ years React experience\nStrong TypeScript skills\nExperience with design systems",
      status: "OPEN",
      publishedAt: new Date(),
      employmentType: "FULL_TIME",
      scoringCriteria: JSON.stringify(["React & Component Architecture", "TypeScript Proficiency", "System Design", "Communication"]),
      organizationId: org.id,
      createdById: recruiter.id,
      hiringManagerId: manager.id,
      pipelineStages: {
        create: [
          { name: "New", order: 0, type: "NEW" },
          { name: "Screen", order: 1, type: "SCREEN" },
          { name: "Interview", order: 2, type: "INTERVIEW" },
          { name: "Offer", order: 3, type: "OFFER" },
          { name: "Hired", order: 4, type: "HIRED" },
        ],
      },
    },
    include: { pipelineStages: true },
  });
  console.log(`  Job: ${job.title} (id: ${job.id})`);
  console.log(`  Scoring criteria: ${job.scoringCriteria}`);

  const stages = await prisma.pipelineStage.findMany({ where: { jobId: job.id }, orderBy: { order: "asc" } });
  const interviewStage = stages.find((s) => s.type === "INTERVIEW") ?? stages[2] ?? stages[0];

  // Create candidate
  const existingCandidate = await prisma.candidate.findFirst({ where: { email: "priya.sharma@example.com", organizationId: org.id } });
  const candidate = existingCandidate ?? await prisma.candidate.create({
    data: {
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@example.com",
      phone: "+91 98765 43210",
      currentTitle: "Frontend Engineer",
      currentCompany: "Flipkart",
      organizationId: org.id,
    },
  });
  console.log(`  Candidate: ${candidate.firstName} ${candidate.lastName}`);

  // Create application
  const existingApp = await prisma.application.findFirst({ where: { candidateId: candidate.id, jobId: job.id } });
  const application = existingApp ?? await prisma.application.create({
    data: {
      candidateId: candidate.id,
      jobId: job.id,
      currentStageId: interviewStage.id,
      status: "ACTIVE",
    },
  });
  console.log(`  Application: ${application.id}`);

  // Create interview with panelists
  const existingInterview = await prisma.interview.findFirst({ where: { applicationId: application.id } });
  const interview = existingInterview ?? await prisma.interview.create({
    data: {
      applicationId: application.id,
      title: "Technical Interview",
      type: "VIDEO",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      durationMinutes: 60,
      timezone: "Asia/Kolkata",
      meetingLink: "https://meet.google.com/abc-defg-hij",
      panelists: {
        create: [
          { userId: interviewer.id, role: "Interviewer" },
          { userId: manager.id, role: "Hiring Manager" },
        ],
      },
    },
  });
  console.log(`  Interview: ${interview.id} (${interview.title})`);
  console.log(`  Panelists: Neha Gupta (Interviewer), Arjun Mehta (Hiring Manager)`);

  console.log("\nDemo data ready!");
  console.log("─────────────────────────────────────────");
  console.log("To test the feedback form:");
  console.log("  1. Log in as:  interviewer@company.com  /  Sports@123");
  console.log("  2. Go to My Interviews");
  console.log(`  3. Open: /dashboard/interviews/${interview.id}`);
  console.log("  4. Select sections, rate criteria, submit");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
