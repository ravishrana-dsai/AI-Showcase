import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, comment } = body;

  if (!["APPROVED", "REJECTED"].includes(action)) {
    return NextResponse.json(
      { error: "action must be APPROVED or REJECTED" },
      { status: 400 }
    );
  }

  const approval = await prisma.jobPostingApproval.findFirst({
    where: { jobId: id, approverId: session.user.id, status: "PENDING" },
  });

  if (!approval) {
    return NextResponse.json(
      { error: "No pending approval found for you on this job" },
      { status: 404 }
    );
  }

  await prisma.jobPostingApproval.update({
    where: { id: approval.id },
    data: {
      status: action,
      comment: comment?.trim() || null,
      decidedAt: new Date(),
    },
  });

  const allApprovals = await prisma.jobPostingApproval.findMany({
    where: { jobId: id },
    orderBy: { order: "asc" },
  });

  let newStatus: string;
  if (action === "REJECTED") {
    newStatus = "REJECTED";
  } else {
    const allApproved = allApprovals.every(
      (a) => a.id === approval.id || a.status === "APPROVED"
    );
    newStatus = allApproved ? "OPEN" : "PENDING_APPROVAL";
    if (allApproved) {
      // Auto-publish the job
      await prisma.job.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
    }
  }

  await prisma.job.update({ where: { id }, data: { status: newStatus } });

  return NextResponse.json({ success: true, jobStatus: newStatus });
}
