import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, BellRing } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { page?: string; acknowledged?: string };
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 25;
  const showAcknowledged = searchParams.acknowledged === "true";

  const where = { acknowledged: showAcknowledged };

  const [alerts, total, unackCount] = await Promise.all([
    prisma.slaAlert.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          select: {
            id: true,
            externalId: true,
            court: { select: { name: true, city: true } },
          },
        },
        stage: { select: { displayName: true, color: true } },
      },
    }),
    prisma.slaAlert.count({ where }),
    prisma.slaAlert.count({ where: { acknowledged: false } }),
  ]);

  const alertTypeConfig = {
    SLA_WARNING: { label: "SLA Warning", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    SLA_BREACH:  { label: "SLA Breach",  className: "bg-red-100 text-red-700 border-red-200" },
    ERROR:       { label: "Error",       className: "bg-red-100 text-red-700 border-red-200" },
    MANUAL_FLAG: { label: "Flagged",     className: "bg-blue-100 text-blue-700 border-blue-200" },
  };

  return (
    <div>
      <Topbar title="Alerts" subtitle={`${unackCount} unacknowledged`} />
      <div className="p-6 space-y-4">
        {/* Tab toggle */}
        <div className="flex gap-2">
          <Link
            href="/alerts"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !showAcknowledged ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Open ({unackCount})
          </Link>
          <Link
            href="/alerts?acknowledged=true"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              showAcknowledged ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Acknowledged
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Request</th>
                  <th className="px-4 py-3 font-medium">Court</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Message</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  {showAcknowledged && <th className="px-4 py-3 font-medium">Acknowledged By</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((alert) => {
                  const cfg = alertTypeConfig[alert.alertType];
                  return (
                    <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/requests/${alert.request.id}`} className="font-mono text-xs text-purple-600 hover:underline">
                          {alert.request.externalId ?? alert.request.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {alert.request.court.name} · {alert.request.court.city}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: alert.stage.color ?? "#6b7280" }}
                          />
                          {alert.stage.displayName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {alert.message ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(alert.createdAt)}</td>
                      {showAcknowledged && (
                        <td className="px-4 py-3 text-xs text-gray-500">{alert.acknowledgedBy ?? "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {alerts.length === 0 && (
            <div className="py-12 text-center">
              {showAcknowledged ? (
                <>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No acknowledged alerts</p>
                </>
              ) : (
                <>
                  <BellRing className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">All clear!</p>
                  <p className="text-sm text-gray-400 mt-1">No open alerts at the moment</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Acknowledge all button (in a real app this would be a client component) */}
        {!showAcknowledged && unackCount > 0 && (
          <p className="text-xs text-gray-400">
            Use the <Link href="/settings" className="text-purple-600 hover:underline">API</Link> or bulk action to acknowledge alerts.
          </p>
        )}
      </div>
    </div>
  );
}
