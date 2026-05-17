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
    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(role);
  } catch (err) {
    console.error("[GET /api/admin/roles/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      name?: string;
      questionBank?: string[];
      scoringWeights?: Record<string, number>;
    };

    const role = await prisma.role.update({
      where: { id: params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.questionBank ? { questionBank: body.questionBank as never } : {}),
        ...(body.scoringWeights
          ? { scoringWeights: body.scoringWeights as never }
          : {}),
      },
    });

    return NextResponse.json(role);
  } catch (err) {
    console.error("[PUT /api/admin/roles/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    await prisma.role.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/roles/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
