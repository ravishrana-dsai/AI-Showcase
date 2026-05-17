import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { fireWebhooks } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { applicationId, stageId } = body;

    if (!applicationId || !stageId) {
      return NextResponse.json(
        { error: "applicationId and stageId are required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        currentStage: true,
        job: { select: { id: true, title: true, createdById: true, hiringManagerId: true } },
        candidate: { select: { firstName: true, lastName: true } },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Verify stage belongs to same job
    const newStage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, jobId: application.jobId },
    });

    if (!newStage) {
      return NextResponse.json(
        { error: "Stage not found or does not belong to this job" },
        { status: 400 }
      );
    }

    if (application.currentStageId === stageId) {
      return NextResponse.json(
        { error: "Application is already in this stage" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update previous stage history - set exitedAt
    await prisma.stageHistory.updateMany({
      where: {
        applicationId,
        stageId: application.currentStageId,
        exitedAt: null,
      },
      data: { exitedAt: now, movedById: session.user.id },
    });

    // Create new stage history entry
    await prisma.stageHistory.create({
      data: {
        applicationId,
        stageId,
        enteredAt: now,
        movedById: session.user.id,
      },
    });

    // Update application
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { currentStageId: stageId },
      include: {
        currentStage: true,
        candidate: true,
        job: true,
      },
    });

    // Create ActivityLog
    const organizationId = (session.user as { organizationId?: string })
      .organizationId;
    if (organizationId) {
      await prisma.activityLog.create({
        data: {
          type: "STAGE_MOVED",
          description: `Application moved from ${application.currentStage.name} to ${newStage.name}`,
          metadata: JSON.stringify({
            applicationId,
            fromStageId: application.currentStageId,
            toStageId: stageId,
          }),
          candidateId: application.candidateId,
          actorId: session.user.id,
          organizationId,
        },
      });
    }

    // Notify job owner and hiring manager (excluding mover)
    const candidateName = application.candidate
      ? `${application.candidate.firstName} ${application.candidate.lastName}`
      : "A candidate";
    const toNotify = [
      application.job.createdById,
      application.job.hiringManagerId,
    ].filter((id): id is string => !!id && id !== session.user?.id);
    const uniqueIds = [...new Set(toNotify)];
    if (uniqueIds.length > 0) {
      await prisma.notification.createMany({
        data: uniqueIds.map((userId) => ({
          userId,
          type: "STAGE_MOVED",
          title: "Application moved",
          message: `${candidateName} was moved to ${newStage.name} for ${application.job.title}`,
          link: `/dashboard/jobs/${application.job.id}`,
        })),
      });
    }

    if (organizationId) {
      fireWebhooks(organizationId, "application.stage_changed", {
        applicationId,
        jobId: application.jobId,
        candidateId: application.candidateId,
        fromStageId: application.currentStageId,
        toStageId: stageId,
        fromStageName: application.currentStage.name,
        toStageName: newStage.name,
      }).catch((e) => console.error("Webhook fire error:", e));
    }

    return NextResponse.json(updatedApplication);
  } catch (error) {
    console.error("Move application error:", error);
    return NextResponse.json(
      { error: "Failed to move application" },
      { status: 500 }
    );
  }
}
