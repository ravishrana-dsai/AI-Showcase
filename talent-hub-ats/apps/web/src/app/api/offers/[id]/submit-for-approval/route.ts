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
  const { approverIds } = body; // string[]

  if (!Array.isArray(approverIds) || approverIds.length === 0) {
    return NextResponse.json(
      { error: "approverIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: { approvals: true },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (offer.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only DRAFT offers can be submitted for approval" },
      { status: 400 }
    );
  }

  // Remove any prior approvals and recreate
  await prisma.offerApproval.deleteMany({ where: { offerId: id } });

  await prisma.offerApproval.createMany({
    data: approverIds.map((approverId: string, idx: number) => ({
      offerId: id,
      approverId,
      order: idx + 1,
      status: "PENDING",
    })),
  });

  await prisma.offer.update({
    where: { id },
    data: { status: "PENDING_APPROVAL" },
  });

  return NextResponse.json({ success: true });
}
