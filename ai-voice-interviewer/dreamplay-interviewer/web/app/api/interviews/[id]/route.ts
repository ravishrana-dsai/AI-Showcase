import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: { id: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: params.id },
      include: { candidate: true, role: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    return NextResponse.json(interview);
  } catch (err) {
    console.error("[GET /api/interviews/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { notes?: string; status?: string };

    const updated = await prisma.interview.update({
      where: { id: params.id },
      data: {
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { candidate: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/interviews/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
