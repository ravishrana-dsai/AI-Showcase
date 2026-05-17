import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.pipelineTemplate.findMany({
    where: { organizationId: session.user.organizationId },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, stages, isDefault } = body;

  if (!name || !Array.isArray(stages) || stages.length === 0) {
    return NextResponse.json(
      { error: "name and stages are required" },
      { status: 400 }
    );
  }

  if (isDefault) {
    // Unset other defaults
    await prisma.pipelineTemplate.updateMany({
      where: { organizationId: session.user.organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.pipelineTemplate.create({
    data: {
      name,
      isDefault: isDefault ?? false,
      organizationId: session.user.organizationId,
      stages: {
        create: stages.map(
          (s: { name: string; type?: string }, idx: number) => ({
            name: s.name,
            order: idx,
            type: s.type || "CUSTOM",
          })
        ),
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(template, { status: 201 });
}
