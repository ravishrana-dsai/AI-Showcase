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

  const field = await prisma.customFieldDefinition.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  await prisma.customFieldDefinition.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
