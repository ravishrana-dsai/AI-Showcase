import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { subDays, startOfDay, format } from "date-fns";
import { BarChart3, TrendingUp, Clock, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const now = new Date();
  const last30 = subDays(now, 30);
  const last7 = subDays(now, 7);

  const [
    totalRequests,
    completedLast30,
    failedLast30,
    slaBreachedLast30,
    topCourts,
    stageAvgTimes,
    dailyVolume,
  ] = await Promise.all([
    prisma.request.count(),
    prisma.request.count({ where: { status: "COMPLETED", createdAt: { gte: last30 } } }),
    prisma.request.count({ where: { status: "FAILED", createdAt: { gte: last30 } } }),
    prisma.request.count({ where: { slaBreached: true, createdAt: { gte: last30 } } }),
    // Top courts by request volume
    prisma.court.findMany({
      include: { _count: { select: { requests: true } } },
      orderBy: { requests: { _count: "desc" } },
      take: 10,
    }),
    // Average time per stage
    prisma.requestStageLog.groupBy({
      by: ["stageId"],
      where: { status: "COMPLETED", durationMin: { not: null } },
      _avg: { durationMin: true },
      _count: { id: true },
    }),
    // Daily volume for last 14 days
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE(created_at)::text as date, COUNT(*)::bigint as count
      FROM requests
      WHERE created_at >= ${subDays(now, 13)}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  // Resolve stage names
  const stages = await prisma.pipelineStage.findMany({
    where: { id: { in: stageAvgTimes.map((s) => s.stageId) } },
    select: { id: true, displayName: true, color: true, stageOrder: true },
  });
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s]));

  const stageTimings = stageAvgTimes
    .map((s) => ({
      displayName: stageMap[s.stageId]?.displayName ?? s.stageId,
      color: stageMap[s.stageId]?.color ?? "#8b5cf6",
      avgMinutes: Number(s._avg.durationMin ?? 0),
      count: s._count.id,
      order: stageMap[s.stageId]?.stageOrder ?? 99,
    }))
    .sort((a, b) => a.order - b.order);

  // Build daily volume map
  const volumeMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    volumeMap[format(subDays(now, i), "yyyy-MM-dd")] = 0;
  }
  for (const row of dailyVolume) {
    if (volumeMap[row.date] !== undefined) volumeMap[row.date] = Number(row.count);
  }

  const completionRate = completedLast30 + failedLast30 > 0
    ? Math.round((completedLast30 / (completedLast30 + failedLast30)) * 100)
    : 0;

  const maxVolume = Math.max(...Object.values(volumeMap), 1);

  return (
    <div>
      <Topbar title="Analytics" subtitle="Last 30 days performance" />
      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Completed (30d)" value={completedLast30} icon={TrendingUp} iconColor="text-green-600" />
          <StatCard title="Failed (30d)" value={failedLast30} icon={AlertTriangle} iconColor="text-red-500" />
          <StatCard title="Completion Rate" value={`${completionRate}%`} icon={BarChart3} iconColor="text-blue-600" />
          <StatCard title="SLA Breached (30d)" value={slaBreachedLast30} icon={Clock} iconColor="text-orange-500" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Daily Volume (14 days) */}
          <Card>
            <CardHeader><CardTitle>Daily Request Volume (14 days)</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-40">
                {Object.entries(volumeMap).map(([date, count]) => (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full rounded-t bg-purple-200 hover:bg-purple-400 transition-colors relative group"
                      style={{ height: `${(count / maxVolume) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                    >
                      {count > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          {count}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 rotate-45 origin-left" style={{ fontSize: "9px" }}>
                      {format(new Date(date), "d MMM")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Avg time per stage */}
          <Card>
            <CardHeader><CardTitle>Avg Processing Time per Stage</CardTitle></CardHeader>
            <CardContent>
              {stageTimings.length > 0 ? (
                <div className="space-y-3">
                  {stageTimings.map((stage) => {
                    const hours = Math.floor(stage.avgMinutes / 60);
                    const mins = Math.round(stage.avgMinutes % 60);
                    const label = hours > 0 ? `${hours}h ${mins}m` : `${Math.round(stage.avgMinutes)}m`;
                    const maxMinutes = Math.max(...stageTimings.map((s) => s.avgMinutes), 1);
                    return (
                      <div key={stage.displayName}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 text-gray-700">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            {stage.displayName}
                          </span>
                          <span className="font-medium text-gray-900">{label}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${(stage.avgMinutes / maxMinutes) * 100}%`,
                              backgroundColor: stage.color,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{stage.count} completed</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No completed stage data yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Courts by Volume */}
        <Card>
          <CardHeader><CardTitle>Top Courts by Request Volume</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Court</th>
                    <th className="pb-2 font-medium">City</th>
                    <th className="pb-2 font-medium">Partner</th>
                    <th className="pb-2 font-medium">Total Requests</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topCourts.map((court, i) => (
                    <tr key={court.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-400">{i + 1}</td>
                      <td className="py-2.5">
                        <a href={`/courts/${court.id}`} className="font-medium text-gray-800 hover:text-purple-600">
                          {court.name}
                        </a>
                      </td>
                      <td className="py-2.5 text-gray-500">{court.city}</td>
                      <td className="py-2.5 text-gray-500">{court.partnerName ?? "—"}</td>
                      <td className="py-2.5 font-semibold text-gray-900">{court._count.requests}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          court.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                          court.status === "ONBOARDING" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {court.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topCourts.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">No courts added yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
