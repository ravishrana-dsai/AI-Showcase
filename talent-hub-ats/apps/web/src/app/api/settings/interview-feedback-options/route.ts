import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

const KEY = "interviewFeedbackOptions";

const DEFAULT_OPTIONS = [
  { value: "PROCEED", label: "Proceed to next stage" },
  { value: "REJECT", label: "Reject" },
];

function getSettings(org: { settings: string }) {
  try {
    return (JSON.parse(org.settings || "{}") as Record<string, unknown>);
  } catch {
    return {};
  }
}

function getOptions(org: { settings: string }): { value: string; label: string }[] {
  const settings = getSettings(org);
  const raw = settings[KEY];
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter(
      (o: unknown): o is { value: string; label: string } =>
        typeof o === "object" &&
        o !== null &&
        typeof (o as { value?: string }).value === "string" &&
        typeof (o as { label?: string }).label === "string"
    ).map((o) => ({ value: String(o.value).trim(), label: String(o.label).trim() }));
  }
  return DEFAULT_OPTIONS;
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
    const options = getOptions(org);
    return NextResponse.json({ options });
  } catch (error) {
    console.error("Get interview feedback options:", error);
    return NextResponse.json(
      { error: "Failed to load options" },
      { status: 500 }
    );
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
  const role = (session.user as { role?: string }).role;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const raw = body.options;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "options must be a non-empty array of { value, label }" },
        { status: 400 }
      );
    }
    const options = raw
      .filter(
        (o: unknown): o is { value: string; label: string } =>
          typeof o === "object" &&
          o !== null &&
          typeof (o as { value?: string }).value === "string" &&
          typeof (o as { label?: string }).label === "string"
      )
      .map((o) => ({ value: String(o.value).trim(), label: String(o.label).trim() }));
    if (options.length === 0) {
      return NextResponse.json(
        { error: "At least one valid option { value, label } required" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const settings = getSettings(org);
    settings[KEY] = options;
    await prisma.organization.update({
      where: { id: organizationId },
      data: { settings: JSON.stringify(settings) },
    });
    return NextResponse.json({ options });
  } catch (error) {
    console.error("Update interview feedback options:", error);
    return NextResponse.json(
      { error: "Failed to save options" },
      { status: 500 }
    );
  }
}
