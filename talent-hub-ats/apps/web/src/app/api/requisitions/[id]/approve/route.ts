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
  const { action, comment } = body; // action: "APPROVED" | "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(action)) {
    return NextResponse.json(
      { error: "action must be APPROVED or REJECTED" },
      { status: 400 }
    );
  }

  const approval = await prisma.requisitionApproval.findFirst({
    where: {
      requisitionId: id,
      approverId: session.user.id,
      status: "PENDING",
    },
  });

  if (!approval) {
    return NextResponse.json(
      { error: "No pending approval found for you on this requisition" },
      { status: 404 }
    );
  }

  await prisma.requisitionApproval.update({
    where: { id: approval.id },
    data: {
      status: action,
      comment: comment?.trim() || null,
      decidedAt: new Date(),
    },
  });

  // Determine overall requisition status
  const allApprovals = await prisma.requisitionApproval.findMany({
    where: { requisitionId: id },
    orderBy: { order: "asc" },
  });

  let newStatus: string;
  if (action === "REJECTED") {
    newStatus = "REJECTED";
  } else {
    const allApproved = allApprovals.every(
      (a) => a.id === approval.id || a.status === "APPROVED"
    );
    newStatus = allApproved ? "APPROVED" : "PENDING";
  }

  await prisma.requisition.update({
    where: { id },
    data: { status: newStatus },
  });

  return NextResponse.json({ success: true, requisitionStatus: newStatus });
}
