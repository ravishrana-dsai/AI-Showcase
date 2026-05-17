export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { EeoDashboard } from "@/components/analytics/eeo-dashboard";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function EeoDashboardPage() {
  const user = await requireAuth();

  const jobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/analytics"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Analytics
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">EEO / Diversity Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated EEO data from voluntary self-identification forms. Individual responses are never shown.
        </p>
      </div>
      <EeoDashboard jobs={jobs} />
    </div>
  );
}
