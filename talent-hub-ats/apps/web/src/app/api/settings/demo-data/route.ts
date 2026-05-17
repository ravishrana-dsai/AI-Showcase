import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

const KEY = "hideDemoData";

function getSettings(org: { settings: string }) {
  try {
    return (JSON.parse(org.settings || "{}") as Record<string, unknown>);
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
  const role = (session.user as { role?: string }).role;
  if (!organizationId || !["SUPER_ADMIN", "ADMIN", "RECRUITER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = getSettings(org);
    return NextResponse.json({ hideDemoData: settings[KEY] === true });
  } catch (error) {
    console.error("Get demo data setting:", error);
    return NextResponse.json({ error: "Failed to load setting" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  const role = (session.user as { role?: string }).role;
  if (!organizationId || !["SUPER_ADMIN", "ADMIN", "RECRUITER"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const hideDemoData = Boolean(body.hideDemoData);
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = getSettings(org);
    settings[KEY] = hideDemoData;
    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: JSON.stringify(settings) },
    });
    return NextResponse.json({ hideDemoData });
  } catch (error) {
    console.error("Update demo data setting:", error);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}
