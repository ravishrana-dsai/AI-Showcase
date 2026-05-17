export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { BarChart3, TrendingUp, Clock, Target, Download, GitBranch, Users } from "lucide-react";
import Link from "next/link";

export default async function AnalyticsPage() {
  const user = await requireAuth();

  const pipelineData = await prisma.application.groupBy({
    by: ["status"],
    where: { job: { organizationId: user.organizationId } },
    _count: { id: true },
  });

  const sourceData = await prisma.candidate.groupBy({
    by: ["source"],
    where: { organizationId: user.organizationId, source: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const topJobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId, status: "OPEN" },
    include: { _count: { select: { applications: true } } },
    orderBy: { applications: { _count: "desc" } },
    take: 5,
  });

  // Time-to-hire: applications that were hired
  const hiredApps = await prisma.application.findMany({
    where: { job: { organizationId: user.organizationId }, status: "HIRED", hiredAt: { not: null } },
    select: { appliedAt: true, hiredAt: true, job: { select: { title: true } } },
    take: 100,
    orderBy: { hiredAt: "desc" },
  });

  const timeToHireData = hiredApps.map((a) => {
    const days = Math.round((new Date(a.hiredAt!).getTime() - new Date(a.appliedAt).getTime()) / 86400000);
    return { jobTitle: a.job.title, days };
  });

  const avgTimeToHire = timeToHireData.length > 0 ? Math.round(timeToHireData.reduce((sum, t) => sum + t.days, 0) / timeToHireData.length) : null;

  // Stage time: how long candidates spend in each stage
  const stageHistory = await prisma.stageHistory.findMany({
    where: { application: { job: { organizationId: user.organizationId } }, exitedAt: { not: null } },
    select: { stage: { select: { name: true } }, enteredAt: true, exitedAt: true },
    take: 500,
    orderBy: { enteredAt: "desc" },
  });

  const stageTimeMap: Record<string, { total: number; count: number }> = {};
  stageHistory.forEach((sh) => {
    if (!sh.exitedAt) return;
    const days = Math.round((new Date(sh.exitedAt).getTime() - new Date(sh.enteredAt).getTime()) / 86400000);
    if (!stageTimeMap[sh.stage.name]) stageTimeMap[sh.stage.name] = { total: 0, count: 0 };
    stageTimeMap[sh.stage.name].total += days;
    stageTimeMap[sh.stage.name].count += 1;
  });

  const stageTimeData = Object.entries(stageTimeMap).map(([name, data]) => ({
    name,
    avgDays: Math.round(data.total / data.count),
  })).sort((a, b) => b.avgDays - a.avgDays);

  const statusMap: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: "Active", color: "bg-blue-500" },
    HIRED: { label: "Hired", color: "bg-green-500" },
    REJECTED: { label: "Rejected", color: "bg-red-500" },
    WITHDRAWN: { label: "Withdrawn", color: "bg-orange-500" },
    ARCHIVED: { label: "Archived", color: "bg-gray-500" },
  };

  const totalApplications = pipelineData.reduce((sum, item) => sum + item._count.id, 0);

  // Offer acceptance rate: accepted / (accepted + declined)
  const offersResolved = await prisma.offer.groupBy({
    by: ["status"],
    where: {
      application: { job: { organizationId: user.organizationId } },
      status: { in: ["ACCEPTED", "DECLINED", "SENT"] },
    },
    _count: { id: true },
  });
  const acceptedCount = offersResolved.find((o) => o.status === "ACCEPTED")?._count.id ?? 0;
  const declinedCount = offersResolved.find((o) => o.status === "DECLINED")?._count.id ?? 0;
  const sentCount = offersResolved.find((o) => o.status === "SENT")?._count.id ?? 0;
  const resolvedTotal = acceptedCount + declinedCount;
  const offerAcceptanceRate =
    resolvedTotal > 0 ? Math.round((acceptedCount / resolvedTotal) * 100) : null;

  // Time-to-fill: requisition approval → offer accepted (avg days). Use job createdAt as proxy if no requisition.
  const acceptedOffers = await prisma.offer.findMany({
    where: {
      application: { job: { organizationId: user.organizationId } },
      status: "ACCEPTED",
      acceptedAt: { not: null },
    },
    select: {
      acceptedAt: true,
      application: {
        select: {
          job: {
            select: {
              createdAt: true,
              requisitionId: true,
              requisition: {
                select: {
                  createdAt: true,
                  approvals: {
                    where: { status: "APPROVED" },
                    orderBy: { decidedAt: "desc" },
                    take: 1,
                    select: { decidedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    take: 50,
  });
  const timeToFillDays: number[] = [];
  for (const o of acceptedOffers) {
    if (!o.acceptedAt) continue;
    const job = o.application.job;
    const end = new Date(o.acceptedAt).getTime();
    let start: number;
    const req = job.requisition;
    if (req?.approvals?.[0]?.decidedAt) {
      start = new Date(req.approvals[0].decidedAt).getTime();
    } else if (req?.createdAt) {
      start = new Date(req.createdAt).getTime();
    } else {
      start = new Date(job.createdAt).getTime();
    }
    timeToFillDays.push(Math.round((end - start) / 86400000));
  }
  const avgTimeToFill =
    timeToFillDays.length > 0
      ? Math.round(timeToFillDays.reduce((s, d) => s + d, 0) / timeToFillDays.length)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Insights into your hiring pipeline performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/api/export?type=candidates" target="_blank" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />Export Candidates
          </Link>
          <Link href="/api/export?type=applications" target="_blank" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Download className="w-4 h-4" />Export Applications
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Total Applications</p>
          <p className="text-3xl font-bold mt-1">{totalApplications}</p>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Avg Time to Hire</p>
          <p className="text-3xl font-bold mt-1">{avgTimeToHire !== null ? `${avgTimeToHire} days` : "N/A"}</p>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Avg Time to Fill</p>
          <p className="text-3xl font-bold mt-1">{avgTimeToFill !== null ? `${avgTimeToFill} days` : "N/A"}</p>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Offer acceptance rate</p>
          <p className="text-3xl font-bold mt-1">{offerAcceptanceRate !== null ? `${offerAcceptanceRate}%` : "N/A"}</p>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Open Jobs</p>
          <p className="text-3xl font-bold mt-1">{topJobs.length}</p>
        </div>
      </div>

      {/* Deep Analytics Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/analytics/pipeline"
          className="bg-card rounded-xl border p-5 hover:bg-muted/40 transition-colors flex items-start gap-4"
        >
          <div className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg p-2">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Pipeline Funnel</p>
            <p className="text-xs text-muted-foreground mt-1">Stage conversion rates and drop-off analysis</p>
          </div>
        </Link>
        <Link
          href="/dashboard/analytics/eeo"
          className="bg-card rounded-xl border p-5 hover:bg-muted/40 transition-colors flex items-start gap-4"
        >
          <div className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg p-2">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">EEO / Diversity</p>
            <p className="text-xs text-muted-foreground mt-1">Demographics and representation data</p>
          </div>
        </Link>
        <Link
          href="/dashboard/analytics/time-to-hire"
          className="bg-card rounded-xl border p-5 hover:bg-muted/40 transition-colors flex items-start gap-4"
        >
          <div className="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg p-2">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Time-to-Hire Detail</p>
            <p className="text-xs text-muted-foreground mt-1">Per-job breakdown with filters</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Pipeline Overview</h2>
          </div>
          {totalApplications === 0 ? <p className="text-muted-foreground text-sm">No data yet.</p> : (
            <div className="space-y-3">
              {pipelineData.map((item) => {
                const config = statusMap[item.status] || { label: item.status, color: "bg-gray-400" };
                const pct = Math.round((item._count.id / totalApplications) * 100);
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-muted-foreground">{item._count.id} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className={`${config.color} h-2.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source Effectiveness */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Source Effectiveness</h2>
          </div>
          {sourceData.length === 0 ? <p className="text-muted-foreground text-sm">No data yet.</p> : (
            <div className="space-y-3">
              {sourceData.map((item) => {
                const total = sourceData.reduce((s, x) => s + x._count.id, 0);
                const pct = Math.round((item._count.id / total) * 100);
                return (
                  <div key={item.source} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-info" />
                      <span className="text-sm font-medium">{item.source || "Unknown"}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item._count.id} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time in Stage */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Avg Time in Stage</h2>
          </div>
          {stageTimeData.length === 0 ? <p className="text-muted-foreground text-sm">No stage transition data yet.</p> : (
            <div className="space-y-3">
              {stageTimeData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground">{s.avgDays} day{s.avgDays !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Jobs */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Most Active Jobs</h2>
          </div>
          {topJobs.length === 0 ? <p className="text-muted-foreground text-sm">No active jobs yet.</p> : (
            <div className="space-y-3">
              {topJobs.map((job) => (
                <Link key={job.id} href={`/dashboard/jobs/${job.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="font-medium text-sm">{job.title}</span>
                  <span className="text-sm text-muted-foreground">{job._count.applications} applications</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
