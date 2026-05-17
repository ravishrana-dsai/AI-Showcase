import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      department: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}
