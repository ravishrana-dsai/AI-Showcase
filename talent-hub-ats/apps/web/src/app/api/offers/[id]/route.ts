import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true, title: true } },
        },
        orderBy: { order: "asc" },
      },
      application: {
        include: {
          candidate: {
            select: { id: true, firstName: true, lastName: true, email: true, currentTitle: true, currentCompany: true },
          },
          job: { select: { id: true, title: true } },
          currentStage: { select: { name: true } },
        },
      },
    },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  return NextResponse.json(offer);
}
