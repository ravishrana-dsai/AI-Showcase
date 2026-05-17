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

  const req = await prisma.requisition.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      approvals: {
        include: {
          approver: { select: { id: true, name: true, email: true, title: true } },
        },
        orderBy: { order: "asc" },
      },
      jobs: {
        select: {
          id: true,
          title: true,
          status: true,
          publishedAt: true,
          _count: { select: { applications: true } },
        },
      },
    },
  });

  if (!req) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  return NextResponse.json(req);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  const requisition = await prisma.requisition.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: { approvals: true },
  });

  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  if (action === "submit") {
    if (requisition.status !== "DRAFT") {
      return NextResponse.json({ error: "Only DRAFT requisitions can be submitted" }, { status: 400 });
    }
    // If no approvers configured, auto-approve
    const newStatus = requisition.approvals.length === 0 ? "APPROVED" : "PENDING";
    const updated = await prisma.requisition.update({
      where: { id },
      data: { status: newStatus },
    });
    return NextResponse.json(updated);
  }

  if (action === "set-status") {
    const userRole = (session.user as { role?: string }).role ?? "";
    if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const validStatuses = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const updated = await prisma.requisition.update({
      where: { id },
      data: { status: body.status },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userRole = (session.user as { role?: string }).role ?? "";
  if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.requisition.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }
    // Nullify requisitionId on linked jobs (no onDelete cascade defined on Job.requisitionId)
    await prisma.job.updateMany({
      where: { requisitionId: id },
      data: { requisitionId: null },
    });
    await prisma.requisition.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete requisition error:", error);
    return NextResponse.json({ error: "Failed to delete requisition" }, { status: 500 });
  }
}
