export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { RequisitionsListClient } from "@/components/requisitions/requisitions-list-client";

export default async function RequisitionsPage() {
  const user = await requireAuth();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const requisitions = await prisma.requisition.findMany({
    where: { organizationId: user.organizationId, ...demoWhere },
    include: {
      approvals: {
        include: {
          approver: { select: { name: true } },
        },
        orderBy: { order: "asc" },
      },
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = requisitions.map((req) => ({
    ...req,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Requisitions</h1>
          <p className="text-muted-foreground mt-1">
            Manage headcount requests and approvals
          </p>
        </div>
        <Link
          href="/dashboard/requisitions/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </Link>
      </div>

      <RequisitionsListClient requisitions={serialized} />
    </div>
  );
}
