export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { redirect } from "next/navigation";
import { AuditLogViewer } from "@/components/audit-logs/audit-log-viewer";

export default async function AuditLogsPage() {
  const session = await requireAuth();
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    redirect("/dashboard/settings");
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.organizationId, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track all actions taken in your organization. Filtered to your workspace only.
        </p>
      </div>
      <AuditLogViewer initialUsers={users} />
    </div>
  );
}
