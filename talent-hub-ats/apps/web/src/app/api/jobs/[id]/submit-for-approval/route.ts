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
  const { approverIds } = body;

  if (!Array.isArray(approverIds) || approverIds.length === 0) {
    return NextResponse.json(
      { error: "approverIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Remove old approvals and recreate
  await prisma.jobPostingApproval.deleteMany({ where: { jobId: id } });
  await prisma.jobPostingApproval.createMany({
    data: approverIds.map((approverId: string, idx: number) => ({
      jobId: id,
      approverId,
      order: idx + 1,
      status: "PENDING",
    })),
  });

  await prisma.job.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });

  return NextResponse.json({ success: true });
}
