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

  const approval = await prisma.offerApproval.findFirst({
    where: { offerId: id, approverId: session.user.id, status: "PENDING" },
  });

  if (!approval) {
    return NextResponse.json(
      { error: "No pending approval found for you on this offer" },
      { status: 404 }
    );
  }

  await prisma.offerApproval.update({
    where: { id: approval.id },
    data: {
      status: action,
      comment: comment?.trim() || null,
      decidedAt: new Date(),
    },
  });

  const allApprovals = await prisma.offerApproval.findMany({
    where: { offerId: id },
    orderBy: { order: "asc" },
  });

  let newOfferStatus: string;
  if (action === "REJECTED") {
    newOfferStatus = "REJECTED";
  } else {
    const allApproved = allApprovals.every(
      (a) => a.id === approval.id || a.status === "APPROVED"
    );
    newOfferStatus = allApproved ? "APPROVED" : "PENDING_APPROVAL";
  }

  const updatedOffer = await prisma.offer.update({
    where: { id },
    data: { status: newOfferStatus },
  });

  return NextResponse.json({ success: true, offerStatus: newOfferStatus, offer: updatedOffer });
}
