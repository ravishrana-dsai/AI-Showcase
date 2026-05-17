import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const template = await prisma.pipelineTemplate.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (template.isDefault) {
    return NextResponse.json(
      { error: "Cannot delete the default pipeline template" },
      { status: 400 }
    );
  }

  await prisma.pipelineTemplate.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { isDefault } = body;

  if (isDefault) {
    await prisma.pipelineTemplate.updateMany({
      where: { organizationId: session.user.organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.pipelineTemplate.update({
    where: { id },
    data: { isDefault: isDefault ?? false },
    include: { stages: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}
