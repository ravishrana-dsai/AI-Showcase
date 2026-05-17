export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { DemoDataSwitch } from "@/components/dashboard/demo-data-switch";
import { getAssignedJobIds } from "@/lib/sub-recruiter-filter";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireAuth();

  // Interviewers see only My Interviews; redirect to that view by default
  if (["INTERVIEWER", "LIMITED"].includes(user.role)) {
    redirect("/dashboard/my-interviews");
  }

  const isHiringManager = user.role === "HIRING_MANAGER";

  const { view } = await searchParams;
  const isMine = view === "mine";
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const orgWhere = { organizationId: user.organizationId, ...demoWhere };

  // For scoped roles, limit visible data to their jobs
  const isSubRecruiter = user.role === "SUB_RECRUITER";
  const isScopedRole = isSubRecruiter || isHiringManager;
  const assignedJobIds = isSubRecruiter ? await getAssignedJobIds(user.id) : [];

  // Build job-level filters based on role
  let scopedJobFilter: Record<string, unknown> = {};
  let scopedJobIdFilter: Record<string, unknown> = {};

  if (isHiringManager) {
    scopedJobFilter = { hiringManagerId: user.id };
    scopedJobIdFilter = { hiringManagerId: user.id };
  } else if (isSubRecruiter) {
    scopedJobFilter = { OR: [{ id: { in: assignedJobIds } }, { createdById: user.id }] as Record<string, unknown>[] };
    scopedJobIdFilter = { id: { in: assignedJobIds } };
  }

  const allAppWhere = {
    job: { organizationId: user.organizationId, ...demoWhere, ...scopedJobIdFilter },
    status: "ACTIVE" as const,
    ...demoWhere,
  };
  const mineAppWhere = {
    status: "ACTIVE" as const,
    ...demoWhere,
    OR: [
      { recruiterId: user.id, job: { organizationId: user.organizationId, ...demoWhere } },
      { job: { organizationId: user.organizationId, hiringManagerId: user.id, ...demoWhere } },
    ],
  };
  const interviewWhere = {
    ...demoWhere,
    application: {
      job: { organizationId: user.organizationId, ...scopedJobIdFilter },
    },
    status: { in: ["SCHEDULED", "CONFIRMED"] as string[] },
    scheduledAt: { gte: new Date() },
  };
  const offerWhere = {
    ...demoWhere,
    application: {
      job: { organizationId: user.organizationId, ...scopedJobIdFilter },
    },
    status: { in: ["DRAFT", "PENDING_APPROVAL", "SENT"] as string[] },
  };

  const [
    openJobsCount,
    totalCandidates,
    activeApplications,
    upcomingInterviews,
    pendingOffers,
  ] = await Promise.all([
    prisma.job.count({ where: { ...orgWhere, status: "OPEN", ...scopedJobFilter } }),
    prisma.candidate.count({
      where: isHiringManager
        ? { ...orgWhere, isArchived: false, applications: { some: { job: { hiringManagerId: user.id } } } }
        : { ...orgWhere, isArchived: false },
    }),
    prisma.application.count({
      where: isMine ? mineAppWhere : allAppWhere,
    }),
    prisma.interview.count({ where: interviewWhere }),
    prisma.offer.count({ where: offerWhere }),
  ]);

  const allStats = [
    {
      name: "Open Jobs",
      value: openJobsCount,
      icon: Briefcase,
      href: "/dashboard/jobs",
      accent: "from-blue-500/10 to-blue-600/5 border-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      name: "Candidates",
      value: totalCandidates,
      icon: Users,
      href: "/dashboard/candidates",
      accent: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      name: "Active in Pipeline",
      value: activeApplications,
      icon: TrendingUp,
      href: "/dashboard/candidates",
      accent: "from-violet-500/10 to-violet-600/5 border-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      name: "Upcoming Interviews",
      value: upcomingInterviews,
      icon: Calendar,
      href: "/dashboard/interviews",
      accent: "from-amber-500/10 to-amber-600/5 border-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      name: "Pending Offers",
      value: pendingOffers,
      icon: FileText,
      href: "/dashboard/offers",
      accent: "from-rose-500/10 to-rose-600/5 border-rose-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  // Hiring managers: no offers or requisitions stats
  const hiddenStatsForHM = ["Pending Offers"];
  const stats = isHiringManager
    ? allStats.filter((s) => !hiddenStatsForHM.includes(s.name))
    : allStats;

  const firstName = user.name?.split(" ")[0] || "there";
  const showDemoSwitch = false; // Demo data toggle removed for [Company] AI org

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {getGreeting()}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {firstName}
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Here’s your hiring pipeline at a glance. Use the metrics below to jump
              into jobs, candidates, interviews, or offers.
            </p>
          </div>
          {showDemoSwitch && (
            <DemoDataSwitch initialHideDemo={hideDemo} />
          )}
        </div>
      </div>

      {/* Manage Team card — Super Admin only */}
      {user.role === "SUPER_ADMIN" && (
        <div className="rounded-xl border bg-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Manage Team</p>
              <p className="text-xs text-muted-foreground">Create accounts for new team members</p>
            </div>
          </div>
          <Link
            href="/dashboard/settings/team"
            className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            Create Account
          </Link>
        </div>
      )}

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Overview
        </h2>
        <div className={`mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 ${stats.length <= 4 ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
          {stats.map((stat) => (
            <Link
              key={stat.name}
              href={stat.href}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-80`}
                aria-hidden
              />
              <div className="relative flex items-start justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-background/80 shadow-sm ${stat.iconColor}`}
                >
                  <stat.icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="relative mt-4">
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                  {stat.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
