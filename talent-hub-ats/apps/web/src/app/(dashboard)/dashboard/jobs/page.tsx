export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { JobsListClient } from "@/components/jobs/jobs-list-client";
import { OverallPipelineBar } from "@/components/jobs/overall-pipeline-bar";
import { jobWhereForUser } from "@/lib/sub-recruiter-filter";

export default async function JobsPage() {
  const user = await requireAuth();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const baseWhere = { organizationId: user.organizationId, ...demoWhere };
  const jobFilter = await jobWhereForUser(user, baseWhere);

  const [jobs, pipelineCounts] = await Promise.all([
    prisma.job.findMany({
      where: jobFilter,
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
        hiringManager: { select: { name: true } },
        _count: {
          select: {
            applications: { where: { status: "ACTIVE" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Aggregate pipeline counts across all visible jobs
    prisma.application.groupBy({
      by: ["currentStageId"],
      where: {
        status: "ACTIVE",
        job: jobFilter as any,
        currentStageId: { not: undefined },
      },
      _count: { _all: true },
    }),
  ]);

  // Get stage names for the aggregated counts
  const stageIds = pipelineCounts
    .map((p) => p.currentStageId)
    .filter((id): id is string => id !== null);

  const stages = stageIds.length > 0
    ? await prisma.pipelineStage.findMany({
        where: { id: { in: stageIds } },
        select: { id: true, name: true, order: true, type: true },
      })
    : [];

  // Merge counts by stage name (since different jobs may have stages with the same name)
  const mergedByName = stages.reduce<Record<string, { name: string; count: number; minOrder: number }>>((acc, stage) => {
    const count = pipelineCounts.find((p) => p.currentStageId === stage.id)?._count._all ?? 0;
    const existing = acc[stage.name];
    if (existing) {
      return {
        ...acc,
        [stage.name]: {
          ...existing,
          count: existing.count + count,
          minOrder: Math.min(existing.minOrder, stage.order),
        },
      };
    }
    return {
      ...acc,
      [stage.name]: { name: stage.name, count, minOrder: stage.order },
    };
  }, {});

  const pipelineSummary = Object.values(mergedByName)
    .sort((a, b) => a.minOrder - b.minOrder);

  const serialized = jobs.map((job) => ({
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    closedAt: job.closedAt?.toISOString() ?? null,
  }));

  const canCreateJob = !["HIRING_MANAGER", "INTERVIEWER", "LIMITED"].includes(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.role === "HIRING_MANAGER" ? "My Jobs" : "Jobs"}
        description={user.role === "HIRING_MANAGER" ? "Jobs where you are the hiring manager" : "Manage your job postings and track applications"}
        actions={
          canCreateJob ? (
            <Link
              href="/dashboard/jobs/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              Create Job
            </Link>
          ) : undefined
        }
      />

      {pipelineSummary.length > 0 && (
        <OverallPipelineBar stages={pipelineSummary} />
      )}

      <JobsListClient jobs={serialized} />
    </div>
  );
}
