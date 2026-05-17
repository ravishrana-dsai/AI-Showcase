import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

const KEY = "jobDescriptionTemplate";

function getSettings(org: { settings: string }) {
  try {
    return (JSON.parse(org.settings || "{}") as Record<string, string>);
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = getSettings(org);
    return NextResponse.json({ template: settings[KEY] ?? "" });
  } catch (error) {
    console.error("Get job description template:", error);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const template = typeof body.template === "string" ? body.template : "";
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = getSettings(org);
    settings[KEY] = template;
    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: JSON.stringify(settings) },
    });
    return NextResponse.json({ template: settings[KEY] });
  } catch (error) {
    console.error("Update job description template:", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
