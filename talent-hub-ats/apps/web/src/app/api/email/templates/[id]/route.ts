import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, subject, body: templateBody, category } = body;

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const data: { name?: string; subject?: string; body?: string; category?: string | null } = {};
    if (name !== undefined) data.name = String(name).trim();
    if (subject !== undefined) data.subject = String(subject).trim();
    if (templateBody !== undefined) data.body = String(templateBody).trim();
    if (category !== undefined) data.category = category ? String(category).trim() : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(existing);
    }

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  try {
    const { id } = await params;

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.emailTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
