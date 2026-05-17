export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { PageHeader } from "@/components/ui/page-header";
import { AgentClient } from "@/components/agent/agent-client";

export default async function AgentPage() {
  const user = await requireAuth();

  const jobs = await prisma.job.findMany({
    where: {
      organizationId: user.organizationId,
      status: { in: ["DRAFT", "OPEN"] },
    },
    include: {
      department: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const serialized = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    departmentName: j.department?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="TA Agent"
        description="Select a job and let the agent work through each hiring step. Review and approve before anything is saved or sent."
      />
      <AgentClient jobs={serialized} />
    </div>
  );
}
