import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestStatusBadge, SlaBadge } from "@/components/pipeline/status-badge";
import { formatDate, formatDuration } from "@/lib/utils";
import { MapPin, GitBranch, CheckCircle2, AlertTriangle, Clock, Activity, TrendingUp, XCircle } from "lucide-react";
import Link from "next/link";
import { subDays, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();

  const [
    totalCourts,
    activeCourts,
    totalRequests,
    requestsToday,
    pendingRequests,
    inProgressRequests,
    completedRequests,
    failedRequests,
    slaBreached,
    unacknowledgedAlerts,
    recentRequests,
    stageDistribution,
  ] = await Promise.all([
    prisma.court.count(),
    prisma.court.count({ where: { status: "ACTIVE" } }),
    prisma.request.count(),
    prisma.request.count({ where: { createdAt: { gte: startOfDay(now) } } }),
    prisma.request.count({ where: { status: "PENDING" } }),
    prisma.request.count({ where: { status: "IN_PROGRESS" } }),
    prisma.request.count({ where: { status: "COMPLETED" } }),
    prisma.request.count({ where: { status: "FAILED" } }),
    prisma.request.count({ where: { slaBreached: true } }),
    prisma.slaAlert.count({ where: { acknowledged: false } }),
    prisma.request.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        court: { select: { name: true, city: true } },
        stageLogs: {
          where: { status: "IN_PROGRESS" },
          include: { stage: { select: { displayName: true } } },
          take: 1,
        },
      },
    }),
    prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { stageOrder: "asc" },
      include: {
        stageLogs: {
          where: { status: "IN_PROGRESS" },
          select: { id: true },
        },
      },
    }),
  ]);

  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

  return (
    <div>
      <Topbar title="Overview" subtitle={`Good ${getGreeting()}, ${session?.user?.name?.split(" ")[0]}`} />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Active Courts" value={activeCourts} subtitle={`${totalCourts} total`} icon={MapPin} iconColor="text-purple-600" />
          <StatCard title="Total Requests" value={totalRequests} subtitle={`${requestsToday} today`} icon={GitBranch} iconColor="text-blue-600" />
          <StatCard title="Completed" value={completedRequests} subtitle={`${completionRate}% completion rate`} icon={CheckCircle2} iconColor="text-green-600" />
          <StatCard title="SLA Breached" value={slaBreached} subtitle={`${unacknowledgedAlerts} unread alerts`} icon={AlertTriangle} iconColor="text-red-600" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard title="Pending" value={pendingRequests} icon={Clock} iconColor="text-gray-500" />
          <StatCard title="In Progress" value={inProgressRequests} icon={Activity} iconColor="text-blue-500" />
          <StatCard title="Failed" value={failedRequests} icon={XCircle} iconColor="text-red-500" />
          <StatCard title="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} iconColor="text-green-600" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Pipeline Stage Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stageDistribution.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: stage.color ?? "#8b5cf6" }}
                      />
                      <span className="text-sm text-gray-700">{stage.displayName}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {stage.stageLogs.length} active
                    </span>
                  </div>
                ))}
                {stageDistribution.length === 0 && (
                  <p className="text-sm text-gray-400">No active pipeline stages configured</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Requests */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Requests</CardTitle>
              <Link href="/requests" className="text-xs text-purple-600 hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentRequests.map((req) => (
                  <Link key={req.id} href={`/requests/${req.id}`} className="flex items-center justify-between rounded-lg hover:bg-gray-50 px-2 py-1.5 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {req.court.name} — {req.court.city}
                      </p>
                      <p className="text-xs text-gray-400">
                        {req.externalId ?? req.id.slice(-8)} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {req.stageLogs[0] && (
                        <span className="text-xs text-blue-600">{req.stageLogs[0].stage.displayName}</span>
                      )}
                      <RequestStatusBadge status={req.status} />
                      {req.slaBreached && <SlaBadge breached />}
                    </div>
                  </Link>
                ))}
                {recentRequests.length === 0 && (
                  <p className="text-sm text-gray-400">No requests yet. Import data or connect your app backend.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
