import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      department,
      headcount = 1,
      priority = "MEDIUM",
      level,
      salaryMin,
      salaryMax,
      salaryCurrency = "INR",
      justification,
      approverIds = [],
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const validPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: "priority must be one of: LOW, MEDIUM, HIGH, CRITICAL" },
        { status: 400 }
      );
    }

    const organizationId = (session.user as { organizationId?: string })
      .organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const requisition = await prisma.requisition.create({
      data: {
        title: title.trim(),
        departmentId: department || null,
        headcount: Number(headcount) || 1,
        priority,
        level: level || null,
        salaryMin: salaryMin != null ? Number(salaryMin) : null,
        salaryMax: salaryMax != null ? Number(salaryMax) : null,
        salaryCurrency: salaryCurrency || "INR",
        justification: justification?.trim() || null,
        organizationId,
        createdById: session.user.id,
      },
    });

    // Create RequisitionApproval records for each approver
    if (approverIds.length > 0) {
      for (let i = 0; i < approverIds.length; i++) {
        try {
          await prisma.requisitionApproval.create({
            data: { requisitionId: requisition.id, approverId: approverIds[i], order: i },
          });
        } catch {
          // Skip duplicates
        }
      }
    }

    const createdRequisition = await prisma.requisition.findUnique({
      where: { id: requisition.id },
      include: {
        approvals: { include: { approver: true } },
      },
    });

    return NextResponse.json(createdRequisition, { status: 201 });
  } catch (error) {
    console.error("Create requisition error:", error);
    return NextResponse.json(
      { error: "Failed to create requisition" },
      { status: 500 }
    );
  }
}
