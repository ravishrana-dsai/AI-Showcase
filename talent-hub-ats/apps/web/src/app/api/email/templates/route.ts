import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: (session.user as any).organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, subject, body: templateBody, category } = body;

    if (!name || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Name, subject, and body are required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: {
        name: String(name).trim(),
        subject: String(subject).trim(),
        body: String(templateBody).trim(),
        category: category ? String(category).trim() : null,
        organizationId,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
