import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { DEFAULT_VISIBILITY, mergeVisibilityConfig } from "@/lib/visibility";
import type { VisibilityField } from "@/lib/visibility";

const ALLOWED_FIELDS = Object.keys(DEFAULT_VISIBILITY) as VisibilityField[];

const ADMIN_CONFIGURABLE_ROLES = [
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "SUB_RECRUITER",
] as const;

const RECRUITER_CONFIGURABLE_ROLES = ["SUB_RECRUITER"] as const;

type AdminRole = (typeof ADMIN_CONFIGURABLE_ROLES)[number];
type RecruiterRole = (typeof RECRUITER_CONFIGURABLE_ROLES)[number];

function isAdmin(role: string): boolean {
  return ["ADMIN", "SUPER_ADMIN"].includes(role);
}

function isRecruiter(role: string): boolean {
  return role === "RECRUITER";
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.role) && !isRecruiter(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const stored =
    typeof org.visibilityConfig === "object" && org.visibilityConfig !== null
      ? (org.visibilityConfig as Record<string, Record<string, boolean>>)
      : {};

  const merged = mergeVisibilityConfig(stored);

  return NextResponse.json({ visibilityConfig: merged });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role;
  const canPatch = isAdmin(userRole) || isRecruiter(userRole);
  if (!canPatch) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const incoming = body as Record<string, unknown>;

  // Fetch current stored config
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const currentStored =
    typeof org.visibilityConfig === "object" && org.visibilityConfig !== null
      ? (org.visibilityConfig as Record<string, Record<string, boolean>>)
      : {};

  // Admins can update all 4 roles; Recruiters can only update SUB_RECRUITER
  const configurableRoles: readonly string[] = isAdmin(userRole)
    ? ADMIN_CONFIGURABLE_ROLES
    : RECRUITER_CONFIGURABLE_ROLES;

  const updated: Record<string, Record<string, boolean>> = { ...currentStored };

  for (const field of ALLOWED_FIELDS) {
    if (!(field in incoming)) continue;
    const fieldValue = incoming[field];
    if (typeof fieldValue !== "object" || fieldValue === null) continue;

    const fieldObj = fieldValue as Record<string, unknown>;
    const existingField = updated[field] ?? {};
    const newField: Record<string, boolean> = { ...existingField };

    for (const role of configurableRoles) {
      const typedRole = role as AdminRole | RecruiterRole;
      if (typedRole in fieldObj && typeof fieldObj[typedRole] === "boolean") {
        newField[typedRole] = fieldObj[typedRole] as boolean;
      }
    }

    updated[field] = newField;
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { visibilityConfig: updated },
  });

  const merged = mergeVisibilityConfig(updated);

  return NextResponse.json({ visibilityConfig: merged });
}
