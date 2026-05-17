import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { candidateId, jobId, source } = body;

  if (!candidateId || !jobId) {
    return NextResponse.json(
      { error: "candidateId and jobId are required" },
      { status: 400 }
    );
  }

  // Check candidate belongs to org
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: session.user.organizationId },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Check job belongs to org
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: session.user.organizationId },
    include: { pipelineStages: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Check for duplicate
  const existing = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Candidate already has an application for this job" },
      { status: 400 }
    );
  }

  const firstStage = job.pipelineStages[0];
  if (!firstStage) {
    return NextResponse.json(
      { error: "Job has no pipeline stages" },
      { status: 400 }
    );
  }

  const application = await prisma.application.create({
    data: {
      candidateId,
      jobId,
      currentStageId: firstStage.id,
      source: source || "Internal",
      recruiterId: session.user.id,
    },
    include: {
      job: { select: { title: true } },
      currentStage: { select: { name: true } },
    },
  });

  // Log stage history
  await prisma.stageHistory.create({
    data: {
      applicationId: application.id,
      stageId: firstStage.id,
      movedById: session.user.id,
    },
  });

  return NextResponse.json(application, { status: 201 });
}
