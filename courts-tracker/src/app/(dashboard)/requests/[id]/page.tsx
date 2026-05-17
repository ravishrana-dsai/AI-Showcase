import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { RequestStatusBadge, SlaBadge, StageStatusBadge } from "@/components/pipeline/status-badge";
import { StageTimeline } from "@/components/pipeline/stage-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, bytesToMB } from "@/lib/utils";
import { ArrowLeft, Video, AlertTriangle, User, MessageSquare } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();

  const request = await prisma.request.findUnique({
    where: { id: params.id },
    include: {
      court: true,
      stageLogs: {
        include: { stage: true },
        orderBy: [{ stage: { stageOrder: "asc" } }],
      },
      slaAlerts: {
        include: { stage: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!request) notFound();

  const canEdit = session?.user?.role && ["ADMIN", "OPS"].includes(session.user.role);

  return (
    <div>
      <Topbar
        title={`Request ${request.externalId ?? request.id.slice(-8)}`}
        subtitle={`${request.court.name} — ${request.court.city}`}
      />
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/requests" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Requests
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <RequestStatusBadge status={request.status} />
            {request.slaBreached && <SlaBadge breached />}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Stage Timeline */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Pipeline Timeline</CardTitle></CardHeader>
              <CardContent>
                {request.stageLogs.length > 0 ? (
                  <StageTimeline stageLogs={request.stageLogs} />
                ) : (
                  <p className="text-sm text-gray-400">No stage logs yet. Waiting for app backend events.</p>
                )}
              </CardContent>
            </Card>

            {/* Error Log */}
            {request.lastError && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Last Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-red-700 bg-red-50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                    {request.lastError}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* SLA Alerts */}
            {request.slaAlerts.length > 0 && (
              <Card>
                <CardHeader><CardTitle>SLA Alerts ({request.slaAlerts.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {request.slaAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-start justify-between rounded-lg px-3 py-2 text-sm ${
                          alert.alertType === "SLA_BREACH" ? "bg-red-50 text-red-700" :
                          alert.alertType === "ERROR" ? "bg-red-50 text-red-700" :
                          "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        <div>
                          <span className="font-medium">{alert.stage.displayName}</span>
                          {alert.message && <p className="text-xs mt-0.5 opacity-80">{alert.message}</p>}
                        </div>
                        <div className="text-xs opacity-60 ml-3 shrink-0">{formatDate(alert.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Request Details */}
            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Court">
                  <Link href={`/courts/${request.court.id}`} className="text-purple-600 hover:underline">
                    {request.court.name}
                  </Link>
                </DetailRow>
                <DetailRow label="City">{request.court.city}</DetailRow>
                {request.playerName && <DetailRow label="Player">{request.playerName}</DetailRow>}
                {request.playerId && <DetailRow label="Player ID"><span className="font-mono text-xs">{request.playerId}</span></DetailRow>}
                {request.matchDate && <DetailRow label="Match Date">{formatDate(request.matchDate)}</DetailRow>}
                <DetailRow label="Created">{formatDate(request.createdAt)}</DetailRow>
                {request.completedAt && <DetailRow label="Completed">{formatDate(request.completedAt)}</DetailRow>}
                {request.externalId && <DetailRow label="External ID"><span className="font-mono text-xs">{request.externalId}</span></DetailRow>}
                {request.assignedTo && (
                  <DetailRow label="Assigned To">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      {request.assignedTo}
                    </span>
                  </DetailRow>
                )}
              </CardContent>
            </Card>

            {/* Video Metadata */}
            {(request.videoUrl || request.videoDuration || request.videoSizeBytes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-gray-400" />
                    Video
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {request.videoDuration && (
                    <DetailRow label="Duration">{Math.round(request.videoDuration / 60)}m {request.videoDuration % 60}s</DetailRow>
                  )}
                  {request.videoSizeBytes && (
                    <DetailRow label="Size">{bytesToMB(request.videoSizeBytes)}</DetailRow>
                  )}
                  {request.videoUrl && (
                    <DetailRow label="URL">
                      <a href={request.videoUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs truncate block max-w-[180px]">
                        View video
                      </a>
                    </DetailRow>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {(request.notes || canEdit) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-400" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {request.notes ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400">No notes yet.</p>
                  )}
                  {canEdit && (
                    <Link
                      href={`/requests/${request.id}/edit`}
                      className="mt-3 inline-block text-xs text-purple-600 hover:underline"
                    >
                      Edit notes / assignment
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800 text-right">{children}</span>
    </div>
  );
}
