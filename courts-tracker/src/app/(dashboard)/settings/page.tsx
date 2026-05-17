import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) redirect("/dashboard");

  const stages = await prisma.pipelineStage.findMany({ orderBy: { stageOrder: "asc" } });
  const users = session.user.role === "ADMIN"
    ? await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  return (
    <div>
      <Topbar title="Settings" subtitle="Pipeline configuration & user management" />
      <div className="p-6 space-y-6">
        {/* Pipeline Stages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pipeline Stages</CardTitle>
            {session.user.role === "ADMIN" && (
              <a
                href="/settings/stages/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors"
              >
                + Add Stage
              </a>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Order</th>
                    <th className="pb-2 font-medium">Stage</th>
                    <th className="pb-2 font-medium">Name (API key)</th>
                    <th className="pb-2 font-medium">SLA (hours)</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Color</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stages.map((stage) => (
                    <tr key={stage.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-500">{stage.stageOrder}</td>
                      <td className="py-2.5 font-medium text-gray-800">{stage.displayName}</td>
                      <td className="py-2.5"><span className="font-mono text-xs text-gray-500">{stage.name}</span></td>
                      <td className="py-2.5 text-gray-700">{Number(stage.slaHours)}h</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          stage.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {stage.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {stage.color && (
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: stage.color }} />
                            <span className="font-mono text-xs text-gray-400">{stage.color}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stages.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm text-gray-400">No pipeline stages configured yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Default stages: video_upload → annotation → ai_analysis → report_generation</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Webhook Info */}
        <Card>
          <CardHeader><CardTitle>Webhook Integration</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-gray-600">
              Configure your Dreamplay app backend to send events to this webhook endpoint.
              All stage updates and new requests will auto-sync in real-time.
            </p>
            <div className="rounded-lg bg-gray-900 p-4 font-mono text-sm text-green-400">
              POST {process.env.NEXT_PUBLIC_APP_URL}/api/webhook
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-2">Required Header</p>
              <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                x-company-signature: sha256=&#123;HMAC_SHA256(body, WEBHOOK_SECRET)&#125;
              </code>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-2">Event: New Request</p>
              <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">{`{
  "event": "request_created",
  "externalRequestId": "req_abc123",
  "externalCourtId": "court_xyz",
  "playerId": "player_001",
  "playerName": "Rahul Sharma",
  "matchDate": "2024-01-15T10:00:00Z",
  "videoUrl": "https://...",
  "videoDuration": 3600,
  "videoSizeBytes": 524288000,
  "timestamp": "2024-01-15T10:05:00Z"
}`}</pre>
            </div>
            <div>
              <p className="font-medium text-gray-800 mb-2">Event: Stage Update</p>
              <pre className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">{`{
  "event": "stage_update",
  "externalRequestId": "req_abc123",
  "externalCourtId": "court_xyz",
  "stageName": "video_upload",
  "stageStatus": "completed",
  "timestamp": "2024-01-15T10:10:00Z",
  "metadata": { "uploadedBytes": 524288000 }
}`}</pre>
            </div>
            <p className="text-xs text-gray-400">
              Stage names must match the configured pipeline stages above (use the API key column).
              Status can be: <code className="bg-gray-100 px-1 rounded">started</code>, <code className="bg-gray-100 px-1 rounded">completed</code>, <code className="bg-gray-100 px-1 rounded">failed</code>
            </p>
          </CardContent>
        </Card>

        {/* Users (Admin only) */}
        {session.user.role === "ADMIN" && users.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-800">{user.name ?? "—"}</td>
                      <td className="py-2.5 text-gray-600">{user.email}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.role === "ADMIN" ? "bg-purple-100 text-purple-700" :
                          user.role === "OPS" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-gray-400">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
