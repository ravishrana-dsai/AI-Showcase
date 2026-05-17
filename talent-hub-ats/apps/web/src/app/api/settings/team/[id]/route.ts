import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { PERMISSIONS } from "@talent-hub/shared";

const VALID_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "LIMITED",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins/super admins can modify team members
  const userRole = session.user.role as string;
  if (!["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { role, isActive, title } = body;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot modify your own role or status" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Only SUPER_ADMIN can set SUPER_ADMIN role
  if (role === "SUPER_ADMIN" && userRole !== "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "Only a Super Admin can assign the Super Admin role" },
      { status: 403 }
    );
  }

  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (title !== undefined) data.title = title?.trim() || null;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      isActive: true,
    },
  });

  return NextResponse.json(updated);
}
