import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";
import { z } from "zod";

const ALLOWED_ROLES = ["RECRUITER", "HIRING_MANAGER", "ADMIN", "SUPER_ADMIN"];

const bodySchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    organizationId: string;
    role: string;
  };

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { candidateId, jobId } = body;

  // Verify candidate belongs to the same org
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: user.organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Verify job belongs to the same org and fetch first pipeline stage
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: user.organizationId },
    select: {
      id: true,
      title: true,
      pipelineStages: {
        orderBy: { order: "asc" },
        take: 1,
        select: { id: true, name: true },
      },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let firstStage = job.pipelineStages[0];
  if (!firstStage) {
    // Auto-create default stages for jobs that were created without them
    const DEFAULT_STAGES = [
      { name: "New", order: 0, type: "NEW" },
      { name: "Screen", order: 1, type: "SCREEN" },
      { name: "Interview", order: 2, type: "INTERVIEW" },
      { name: "Offer", order: 3, type: "OFFER" },
      { name: "Hired", order: 4, type: "HIRED" },
    ];
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s) => ({ ...s, jobId })),
    });
    const created = await prisma.pipelineStage.findFirst({
      where: { jobId },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    });
    if (!created) {
      return NextResponse.json(
        { error: "Failed to initialise pipeline stages" },
        { status: 500 }
      );
    }
    firstStage = created;
  }

  // Check for an existing application
  const existing = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already applied to this job" },
      { status: 409 }
    );
  }

  // Create the application
  const application = await prisma.application.create({
    data: {
      candidateId,
      jobId,
      currentStageId: firstStage.id,
      status: "ACTIVE",
      source: "Manual",
      recruiterId: user.id,
      stageHistory: {
        create: {
          stageId: firstStage.id,
          enteredAt: new Date(),
          movedById: user.id,
        },
      },
    },
    select: {
      id: true,
      jobId: true,
      job: { select: { title: true } },
      currentStage: { select: { name: true } },
    },
  });

  // Create an activity log entry
  await prisma.activityLog.create({
    data: {
      type: "application_created",
      description: `Added to job "${job.title}" — stage: ${firstStage.name}`,
      candidateId,
      actorId: user.id,
      organizationId: user.organizationId,
    },
  });

  return NextResponse.json(
    {
      success: true,
      application: {
        id: application.id,
        jobId: application.jobId,
        job: application.job,
        currentStage: application.currentStage,
      },
    },
    { status: 201 }
  );
}
