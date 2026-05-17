import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const candidates = await prisma.candidate.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...((dateFrom || dateTo)
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    select: {
      source: true,
      applications: {
        select: {
          status: true,
          appliedAt: true,
          hiredAt: true,
        },
      },
    },
  });

  const sourceMap: Record<
    string,
    { total: number; hired: number; totalDays: number; hiredCount: number }
  > = {};

  for (const candidate of candidates) {
    const source = candidate.source || "Unknown";
    if (!sourceMap[source]) {
      sourceMap[source] = { total: 0, hired: 0, totalDays: 0, hiredCount: 0 };
    }
    sourceMap[source].total++;

    for (const app of candidate.applications) {
      if (app.status === "HIRED" && app.hiredAt) {
        sourceMap[source].hired++;
        const days = Math.round(
          (new Date(app.hiredAt).getTime() - new Date(app.appliedAt).getTime()) / 86400000
        );
        sourceMap[source].totalDays += days;
        sourceMap[source].hiredCount++;
      }
    }
  }

  const result = Object.entries(sourceMap)
    .map(([source, data]) => ({
      source,
      total: data.total,
      hired: data.hired,
      hireRate: data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0,
      avgDaysToHire:
        data.hiredCount > 0 ? Math.round(data.totalDays / data.hiredCount) : null,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({ sources: result });
}
