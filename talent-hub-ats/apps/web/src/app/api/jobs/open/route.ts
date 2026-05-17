import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: {
      organizationId: session.user.organizationId,
      status: { in: ["OPEN", "DRAFT"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      department: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(jobs);
}
