export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CandidatesList } from "@/components/candidates/candidates-list";
import { PageHeader } from "@/components/ui/page-header";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { candidateWhereForUser } from "@/lib/sub-recruiter-filter";

export default async function CandidatesPage() {
  const user = await requireAuth();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const baseCandidateWhere = {
    organizationId: user.organizationId,
    ...demoWhere,
  };
  const candidateFilter = await candidateWhereForUser(user, baseCandidateWhere);

  const candidates = await prisma.candidate.findMany({
    where: candidateFilter,
    include: {
      applications: {
        select: {
          id: true,
          status: true,
          job: { select: { id: true, title: true } },
          currentStage: { select: { name: true } },
        },
        orderBy: { appliedAt: "desc" },
      },
      tags: {
        include: { tag: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = candidates.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    isArchived: c.isArchived,
  }));

  const canManageCandidates = !["HIRING_MANAGER", "INTERVIEWER", "LIMITED"].includes(user.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.role === "HIRING_MANAGER" ? "My Candidates" : "Candidates"}
        description={user.role === "HIRING_MANAGER" ? "Candidates for your jobs" : "Browse and manage your talent pool"}
        actions={
          canManageCandidates ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/candidates/upload"
                className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                Bulk Upload CVs
              </Link>
              <Link
                href="/dashboard/candidates/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                Add Candidate
              </Link>
            </div>
          ) : undefined
        }
      />

      <CandidatesList candidates={serialized} />
    </div>
  );
}
