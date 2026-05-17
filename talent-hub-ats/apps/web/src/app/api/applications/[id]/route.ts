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

  const { id: applicationId } = await params;
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application || application.job.organizationId !== organizationId) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const body = await req.json();
    const { recruiterId } = body;
    const value = recruiterId === undefined || recruiterId === null || recruiterId === ""
      ? null
      : String(recruiterId);

    if (value !== null) {
      const user = await prisma.user.findFirst({
        where: { id: value, organizationId, isActive: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Invalid recruiter" }, { status: 400 });
      }
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { recruiterId: value },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        candidate: true,
        job: true,
        currentStage: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update application error:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
