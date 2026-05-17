import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  {
    name: "Software Engineer (Backend / Full Stack)",
    slug: "software_engineer",
    questionBank: [
      "Tell me about a technically complex system you've built end-to-end.",
      "Walk me through how you'd design a real-time video processing pipeline.",
      "Tell me about a production incident you dealt with — what happened and how did you handle it?",
      "How do you approach building for scale when the product is still evolving?",
      "What draws you to [Company] specifically — what excites you about what we're building?",
      "Where do you see yourself in 2 years, and how does this role fit into that?",
    ],
    scoringWeights: {
      communication: 0.15,
      role_fit: 0.30,
      motivation: 0.20,
      culture_fit: 0.15,
      problem_solving: 0.20,
    },
  },
  {
    name: "Data Scientist (ML / Computer Vision)",
    slug: "data_scientist",
    questionBank: [
      "Walk me through a model you built from scratch — problem to deployment.",
      "How have you worked with video or image data — what were the challenges?",
      "Tell me about a time a model performed well in testing but failed in prod.",
      "How do you stay current with ML research and decide what's worth applying?",
      "What interests you about sports AI and the problems [Company] is solving?",
      "Describe how you'd approach building a skill-scoring model with limited labelled data.",
    ],
    scoringWeights: {
      communication: 0.10,
      role_fit: 0.35,
      motivation: 0.15,
      culture_fit: 0.15,
      problem_solving: 0.25,
    },
  },
  {
    name: "Partnerships Manager (Business / GTM)",
    slug: "partnerships_manager",
    questionBank: [
      "Tell me about a partnership deal you led — how did you structure and close it?",
      "How do you build relationships with new venues or operators from scratch?",
      "Describe a time a deal fell through — what did you learn?",
      "How would you approach pitching [Company] to a mid-size padel club in Dubai?",
      "What's your understanding of how [Company] makes money?",
      "What makes you excited about sports tech, and why [Company] over a larger company?",
    ],
    scoringWeights: {
      communication: 0.25,
      role_fit: 0.25,
      motivation: 0.20,
      culture_fit: 0.20,
      problem_solving: 0.10,
    },
  },
];

async function main() {
  console.log("Seeding default roles...");
  for (const role of roles) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        questionBank: role.questionBank,
        scoringWeights: role.scoringWeights,
      },
      create: {
        name: role.name,
        slug: role.slug,
        questionBank: role.questionBank,
        scoringWeights: role.scoringWeights,
      },
    });
    console.log(`  upserted: ${role.slug}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
