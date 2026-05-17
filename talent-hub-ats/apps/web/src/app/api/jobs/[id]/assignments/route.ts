import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role: string; organizationId?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify job belongs to user's org
  const job = await prisma.job.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const assignments = await prisma.userJobAssignment.findMany({
    where: { jobId: id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, title: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json({ assignments });
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role: string; organizationId?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only ADMIN, SUPER_ADMIN, or RECRUITER can assign
  if (!["ADMIN", "SUPER_ADMIN", "RECRUITER"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;

  // Verify job belongs to user's org
  const job = await prisma.job.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const userId = String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Validate target user exists, is SUB_RECRUITER, and belongs to same org
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: user.organizationId },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found in your organization" }, { status: 404 });
    }
    if (targetUser.role !== "SUB_RECRUITER") {
      return NextResponse.json({ error: "User must have SUB_RECRUITER role" }, { status: 400 });
    }

    // Check if already assigned
    const existing = await prisma.userJobAssignment.findUnique({
      where: { userId_jobId: { userId, jobId: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already assigned to this job" }, { status: 409 });
    }

    const assignment = await prisma.userJobAssignment.create({
      data: {
        userId,
        jobId: id,
        assignedById: user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, title: true } },
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("Assign sub-recruiter error:", error);
    return NextResponse.json({ error: "Failed to assign user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role: string; organizationId?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only ADMIN, SUPER_ADMIN, or RECRUITER can remove assignments
  if (!["ADMIN", "SUPER_ADMIN", "RECRUITER"].includes(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;

  // Verify job belongs to user's org
  const job = await prisma.job.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const userId = String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.userJobAssignment.findUnique({
      where: { userId_jobId: { userId, jobId: id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await prisma.userJobAssignment.delete({
      where: { userId_jobId: { userId, jobId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove sub-recruiter assignment error:", error);
    return NextResponse.json({ error: "Failed to remove assignment" }, { status: 500 });
  }
}
