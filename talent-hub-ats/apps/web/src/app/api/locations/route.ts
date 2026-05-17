import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

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
    const locations = await prisma.location.findMany({
      where: { organizationId },
      select: { id: true, name: true, city: true, country: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Get locations error:", error);
    return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
  }
}
