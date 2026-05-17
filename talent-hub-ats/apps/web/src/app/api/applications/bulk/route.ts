import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { applicationIds, action, stageId } = body;

    if (
      !applicationIds ||
      !Array.isArray(applicationIds) ||
      applicationIds.length === 0
    ) {
      return NextResponse.json(
        { error: "applicationIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    const validActions = ["move", "reject"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: "action must be one of: move, reject" },
        { status: 400 }
      );
    }

    if (action === "move" && !stageId) {
      return NextResponse.json(
        { error: "stageId is required for move action" },
        { status: 400 }
      );
    }

    const organizationId = (session.user as { organizationId?: string })
      .organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let count = 0;

    if (action === "reject") {
      const now = new Date();
      const result = await prisma.application.updateMany({
        where: {
          id: { in: applicationIds },
          job: { organizationId },
        },
        data: { status: "REJECTED", rejectedAt: now },
      });
      count = result.count;
    } else {
      // action === "move"
      const applications = await prisma.application.findMany({
        where: {
          id: { in: applicationIds },
          job: { organizationId },
        },
        include: { currentStage: true },
      });

      const stage = await prisma.pipelineStage.findFirst({
        where: {
          id: stageId,
          job: { organizationId },
        },
      });

      if (!stage) {
        return NextResponse.json(
          { error: "Stage not found" },
          { status: 404 }
        );
      }

      const now = new Date();

      for (const app of applications) {
        if (app.currentStageId === stageId) continue;
        if (app.jobId !== stage.jobId) continue;

        // Set exitedAt on previous stage history
        await prisma.stageHistory.updateMany({
          where: {
            applicationId: app.id,
            stageId: app.currentStageId,
            exitedAt: null,
          },
          data: { exitedAt: now, movedById: session.user.id },
        });

        // Create new stage history
        await prisma.stageHistory.create({
          data: {
            applicationId: app.id,
            stageId,
            enteredAt: now,
            movedById: session.user.id,
          },
        });

        await prisma.application.update({
          where: { id: app.id },
          data: { currentStageId: stageId },
        });
        count++;
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Bulk application action error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
