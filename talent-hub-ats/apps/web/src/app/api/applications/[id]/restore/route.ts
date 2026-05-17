// PATCH /api/applications/[id]/restore
// Restores a REJECTED application back to ACTIVE status at the first pipeline stage
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the application with its job and pipeline stages
  const application = await prisma.application.findFirst({
    where: {
      id,
      job: { organizationId: session.user.organizationId },
    },
    include: {
      job: {
        include: {
          pipelineStages: { orderBy: { order: "asc" }, take: 1 },
        },
      },
    },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "REJECTED") {
    return NextResponse.json(
      { error: "Application is not rejected" },
      { status: 400 }
    );
  }

  const firstStage = application.job.pipelineStages[0];
  if (!firstStage) {
    return NextResponse.json(
      { error: "No pipeline stages found" },
      { status: 400 }
    );
  }

  // Restore the application
  const updated = await prisma.application.update({
    where: { id },
    data: {
      status: "ACTIVE",
      currentStageId: firstStage.id,
      rejectedAt: null,
    },
  });

  return NextResponse.json({ application: updated });
}
