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
  const { organizationId, id: userId } = session.user;

  const requisition = await prisma.requisition.findFirst({
    where: { id, organizationId },
  });

  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }

  if (requisition.status !== "APPROVED") {
    return NextResponse.json({ error: "Requisition must be approved before creating a job" }, { status: 400 });
  }

  // Check if a job is already linked
  const existing = await prisma.job.findFirst({ where: { requisitionId: id } });
  if (existing) {
    return NextResponse.json({ error: "A job is already linked to this requisition", jobId: existing.id }, { status: 409 });
  }

  // Create slug from title
  const slug = requisition.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80) + "-" + Date.now();

  // Validate FK references before creating job
  const [validDept, validLocation] = await Promise.all([
    requisition.departmentId
      ? prisma.department.findUnique({ where: { id: requisition.departmentId }, select: { id: true } })
      : null,
    requisition.locationId
      ? prisma.location.findUnique({ where: { id: requisition.locationId }, select: { id: true } })
      : null,
  ]);

  const DEFAULT_STAGES = [
    { name: "New", order: 0, type: "NEW" },
    { name: "Screen", order: 1, type: "SCREEN" },
    { name: "Interview", order: 2, type: "INTERVIEW" },
    { name: "Offer", order: 3, type: "OFFER" },
    { name: "Hired", order: 4, type: "HIRED" },
  ];

  try {
    const job = await prisma.job.create({
      data: {
        title: requisition.title,
        slug,
        description: "",
        status: "DRAFT",
        employmentType: requisition.employmentType ?? "FULL_TIME",
        salaryMin: requisition.salaryMin,
        salaryMax: requisition.salaryMax,
        salaryCurrency: requisition.salaryCurrency ?? "INR",
        organizationId,
        departmentId: validDept?.id ?? null,
        locationId: validLocation?.id ?? null,
        createdById: userId,
        requisitionId: id,
        pipelineStages: { create: DEFAULT_STAGES },
      },
    });

    return NextResponse.json({ job: { id: job.id, title: job.title, status: job.status } }, { status: 201 });
  } catch (err) {
    console.error("create-job error:", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
