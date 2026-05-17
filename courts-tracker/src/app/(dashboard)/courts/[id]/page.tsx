import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { CourtStatusBadge, RequestStatusBadge, SlaBadge } from "@/components/pipeline/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { MapPin, Users, Phone, Mail, GitBranch, ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CourtDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();

  const court = await prisma.court.findUnique({
    where: { id: params.id },
    include: { _count: { select: { requests: true } } },
  });
  if (!court) notFound();

  const [statusCounts, recentRequests, slaBreached] = await Promise.all([
    prisma.request.groupBy({
      by: ["status"],
      where: { courtId: court.id },
      _count: { status: true },
    }),
    prisma.request.findMany({
      where: { courtId: court.id },
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        stageLogs: {
          where: { status: "IN_PROGRESS" },
          include: { stage: { select: { displayName: true, color: true } } },
          take: 1,
        },
      },
    }),
    prisma.request.count({ where: { courtId: court.id, slaBreached: true } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status]));
  const canEdit = session?.user?.role && ["ADMIN", "OPS"].includes(session.user.role);

  return (
    <div>
      <Topbar title={court.name} subtitle={`${court.city}${court.state ? `, ${court.state}` : ""}`} />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/courts" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Courts
          </Link>
          {canEdit && (
            <Link
              href={`/courts/${court.id}/edit`}
              className="ml-auto flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Court Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Court Details
                <CourtStatusBadge status={court.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={MapPin} label="Location">
                {court.address ?? `${court.city}${court.state ? `, ${court.state}` : ""}, ${court.country}`}
              </InfoRow>
              {court.partnerName && <InfoRow icon={Users} label="Partner">{court.partnerName}</InfoRow>}
              {court.partnerContact && <InfoRow icon={Phone} label="Contact">{court.partnerContact}</InfoRow>}
              {court.partnerEmail && <InfoRow icon={Mail} label="Email">{court.partnerEmail}</InfoRow>}
              {court.surfaceType && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Surface</span>
                  <span className="capitalize font-medium">{court.surfaceType}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Courts</span>
                <span className="font-medium">{court.totalCourts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Added</span>
                <span className="font-medium">{formatDate(court.createdAt)}</span>
              </div>
              {court.externalId && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">External ID</span>
                  <span className="font-mono text-xs text-gray-600">{court.externalId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Request Stats */}
          <Card>
            <CardHeader><CardTitle>Request Stats</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: "Total", value: court._count.requests, color: "text-gray-900" },
                  { label: "Pending", value: byStatus["PENDING"] ?? 0, color: "text-gray-600" },
                  { label: "In Progress", value: byStatus["IN_PROGRESS"] ?? 0, color: "text-blue-600" },
                  { label: "Completed", value: byStatus["COMPLETED"] ?? 0, color: "text-green-600" },
                  { label: "Failed", value: byStatus["FAILED"] ?? 0, color: "text-red-600" },
                  { label: "SLA Breached", value: slaBreached, color: "text-red-700" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className={`text-sm font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card>
            <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
            <CardContent>
              {court._count.requests > 0 ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Completion Rate</span>
                      <span className="font-semibold text-green-600">
                        {Math.round(((byStatus["COMPLETED"] ?? 0) / court._count.requests) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${Math.round(((byStatus["COMPLETED"] ?? 0) / court._count.requests) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Failure Rate</span>
                      <span className="font-semibold text-red-500">
                        {Math.round(((byStatus["FAILED"] ?? 0) / court._count.requests) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-red-400"
                        style={{ width: `${Math.round(((byStatus["FAILED"] ?? 0) / court._count.requests) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No requests yet for this court.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Requests</CardTitle>
            <Link href={`/requests?courtId=${court.id}`} className="text-xs text-purple-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">Request ID</th>
                    <th className="pb-2 font-medium">Player</th>
                    <th className="pb-2 font-medium">Current Stage</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="py-2.5">
                        <Link href={`/requests/${req.id}`} className="font-mono text-xs text-purple-600 hover:underline">
                          {req.externalId ?? req.id.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-2.5 text-gray-700">{req.playerName ?? req.playerId ?? "—"}</td>
                      <td className="py-2.5">
                        {req.stageLogs[0] ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: req.stageLogs[0].stage.color ?? "#3b82f6" }}
                            />
                            {req.stageLogs[0].stage.displayName}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2.5"><RequestStatusBadge status={req.status} /></td>
                      <td className="py-2.5 text-gray-400 text-xs">{formatDate(req.createdAt)}</td>
                      <td className="py-2.5"><SlaBadge breached={req.slaBreached} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentRequests.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">No requests for this court yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-gray-500">{label}: </span>
        <span className="text-gray-800">{children}</span>
      </div>
    </div>
  );
}
