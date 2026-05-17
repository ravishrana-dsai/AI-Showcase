import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding pipeline stages...");

  // Default pipeline stages for Dreamplay padel AI analysis
  const stages = [
    {
      name: "video_upload",
      displayName: "Video Upload",
      description: "Court footage uploaded and stored",
      stageOrder: 1,
      slaHours: 1,
      color: "#3b82f6",
    },
    {
      name: "annotation",
      displayName: "Annotation",
      description: "Video annotated with player positions, ball tracking",
      stageOrder: 2,
      slaHours: 12,
      color: "#8b5cf6",
    },
    {
      name: "ai_analysis",
      displayName: "AI Analysis",
      description: "AI model processes annotated footage and computes metrics",
      stageOrder: 3,
      slaHours: 6,
      color: "#f59e0b",
    },
    {
      name: "report_generation",
      displayName: "Report Generation",
      description: "[Company] Rating and personalized insights generated",
      stageOrder: 4,
      slaHours: 2,
      color: "#10b981",
    },
  ];

  for (const stage of stages) {
    await prisma.pipelineStage.upsert({
      where: { name: stage.name },
      create: stage,
      update: { stageOrder: stage.stageOrder, slaHours: stage.slaHours, color: stage.color },
    });
    console.log(`  ✓ ${stage.displayName}`);
  }

  console.log("\nSeeding sample courts...");
  const courts = [
    { name: "Mumbai Padel Hub", city: "Mumbai", state: "Maharashtra", partnerName: "Sport360", surfaceType: "synthetic", totalCourts: 4, externalId: "court_mum_001", status: "ACTIVE" as const },
    { name: "Delhi Padel Arena", city: "Delhi", state: "Delhi", partnerName: "DLF Sports", surfaceType: "clay", totalCourts: 3, externalId: "court_del_001", status: "ACTIVE" as const },
    { name: "Bengaluru Padel Club", city: "Bengaluru", state: "Karnataka", partnerName: "Koramangala Sports", surfaceType: "synthetic", totalCourts: 2, externalId: "court_blr_001", status: "ONBOARDING" as const },
    { name: "Hyderabad Padel Center", city: "Hyderabad", state: "Telangana", partnerName: "HITEC Sports", surfaceType: "hard", totalCourts: 2, externalId: "court_hyd_001", status: "ACTIVE" as const },
    { name: "Chennai Padel Park", city: "Chennai", state: "Tamil Nadu", partnerName: "Marina Sports", surfaceType: "synthetic", totalCourts: 2, externalId: "court_che_001", status: "ACTIVE" as const },
  ];

  for (const court of courts) {
    await prisma.court.upsert({
      where: { externalId: court.externalId },
      create: court,
      update: {},
    });
    console.log(`  ✓ ${court.name}`);
  }

  console.log("\nSeed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
