import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { subDays, startOfDay, format } from "date-fns";
import type { DashboardStats } from "@/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try cache first
  const cached = await getCache<DashboardStats>(CACHE_KEYS.dashboardStats);
  if (cached) return NextResponse.json({ data: cached });

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = subDays(now, 7);

  const [
    totalCourts,
    activeCourts,
    totalRequests,
    requestsToday,
    requestsThisWeek,
    statusCounts,
    slaBreached,
    unacknowledgedAlerts,
    stageDistribution,
    completedRequests,
  ] = await Promise.all([
    prisma.court.count(),
    prisma.court.count({ where: { status: "ACTIVE" } }),
    prisma.request.count(),
    prisma.request.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.request.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.request.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.request.count({ where: { slaBreached: true } }),
    prisma.slaAlert.count({ where: { acknowledged: false } }),
    prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { stageOrder: "asc" },
      include: { _count: { select: { stageLogs: true } } },
    }),
    prisma.request.aggregate({
      where: { status: "COMPLETED", completedAt: { not: null } },
      _avg: { },
    }),
  ]);

  // Completion trend (last 7 days)
  const trendData = await prisma.$queryRaw<{ date: string; status: string; count: bigint }[]>`
    SELECT
      DATE(created_at)::text as date,
      status,
      COUNT(*)::bigint as count
    FROM requests
    WHERE created_at >= ${weekStart}
      AND status IN ('COMPLETED', 'FAILED')
    GROUP BY DATE(created_at), status
    ORDER BY date ASC
  `;

  const trendMap: Record<string, { completed: number; failed: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = format(subDays(now, i), "yyyy-MM-dd");
    trendMap[d] = { completed: 0, failed: 0 };
  }
  for (const row of trendData) {
    if (trendMap[row.date]) {
      if (row.status === "COMPLETED") trendMap[row.date].completed = Number(row.count);
      if (row.status === "FAILED") trendMap[row.date].failed = Number(row.count);
    }
  }

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status]));

  const stats: DashboardStats = {
    totalCourts,
    activeCourts,
    totalRequests,
    requestsToday,
    requestsThisWeek,
    pendingRequests: byStatus["PENDING"] ?? 0,
    inProgressRequests: byStatus["IN_PROGRESS"] ?? 0,
    completedRequests: byStatus["COMPLETED"] ?? 0,
    failedRequests: byStatus["FAILED"] ?? 0,
    slaBreachedRequests: slaBreached,
    unacknowledgedAlerts,
    avgCompletionTimeMin: null, // computed separately if needed
    byStage: stageDistribution.map((s) => ({
      stageName: s.name,
      displayName: s.displayName,
      count: s._count.stageLogs,
      color: s.color,
    })),
    completionTrend: Object.entries(trendMap).map(([date, v]) => ({ date, ...v })),
  };

  await setCache(CACHE_KEYS.dashboardStats, stats, CACHE_TTL.short);
  return NextResponse.json({ data: stats });
}
