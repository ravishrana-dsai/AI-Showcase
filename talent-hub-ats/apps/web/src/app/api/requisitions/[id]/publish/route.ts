import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const requisition = await prisma.requisition.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      jobs: {
        select: { id: true, status: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  if (!["APPROVED", "PENDING"].includes(requisition.status) && requisition.jobs.length === 0) {
    return NextResponse.json(
      { error: "Requisition must be approved or have a linked job to publish" },
      { status: 400 }
    );
  }

  const linkedJob = requisition.jobs[0];

  if (linkedJob) {
    const updated = await prisma.job.update({
      where: { id: linkedJob.id },
      data: { status: "OPEN", publishedAt: new Date() },
      select: { id: true, title: true, status: true, publishedAt: true },
    });

    return NextResponse.json({ job: updated });
  }

  return NextResponse.json(
    { error: "No linked job found on this requisition. Create a job first." },
    { status: 400 }
  );
}
