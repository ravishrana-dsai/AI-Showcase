import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateRequestSchema = z.object({
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  flags: z.array(z.string()).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.request.findUnique({
    where: { id: params.id },
    include: {
      court: true,
      stageLogs: {
        include: { stage: true },
        orderBy: [{ stage: { stageOrder: "asc" } }, { createdAt: "asc" }],
      },
      slaAlerts: {
        include: { stage: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: request });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.request.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      ...(parsed.data.status === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  return NextResponse.json({ data: updated });
}
