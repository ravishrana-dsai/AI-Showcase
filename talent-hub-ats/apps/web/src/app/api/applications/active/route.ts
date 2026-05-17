import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const applications = await prisma.application.findMany({
      where: {
        status: "ACTIVE",
        job: { organizationId: (session.user as any).organizationId },
      },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Error fetching active applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
