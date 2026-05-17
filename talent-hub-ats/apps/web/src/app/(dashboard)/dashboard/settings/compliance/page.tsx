export const dynamic = 'force-dynamic';

import { requirePermission } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import {
  ShieldCheck,
  FileBarChart,
  Trash2,
  Download,
  Users,
} from "lucide-react";
import Link from "next/link";

export default async function CompliancePage() {
  const user = await requirePermission("settings.manage");

  // Get EEO aggregate data (anonymized)
  const eeoResponses = await prisma.eeoResponse.findMany({
    where: {
      candidate: { organizationId: user.organizationId },
    },
    select: {
      gender: true,
      race: true,
      ethnicity: true,
      veteranStatus: true,
      disabilityStatus: true,
    },
  });

  const totalCandidates = await prisma.candidate.count({
    where: { organizationId: user.organizationId },
  });

  const responseRate =
    totalCandidates > 0
      ? ((eeoResponses.length / totalCandidates) * 100).toFixed(1)
      : "0";

  // Aggregate helper
  function aggregate(field: string) {
    const counts: Record<string, number> = {};
    for (const r of eeoResponses) {
      const value = (r as any)[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label: label.replace(/_/g, " "),
        count,
        percentage:
          eeoResponses.length > 0
            ? ((count / eeoResponses.length) * 100).toFixed(1)
            : "0",
      }));
  }

  const genderData = aggregate("gender");
  const raceData = aggregate("race");
  const ethnicityData = aggregate("ethnicity");
  const veteranData = aggregate("veteranStatus");
  const disabilityData = aggregate("disabilityStatus");

  // Recent audit logs
  const recentAudits = await prisma.auditLog.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance & Reporting</h1>
          <p className="text-muted-foreground mt-1">
            EEO/EEOC reporting, OFCCP compliance, GPlayer Rating data management, and
            audit trail
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCandidates}</p>
              <p className="text-sm text-muted-foreground">Total Candidates</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <FileBarChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eeoResponses.length}</p>
              <p className="text-sm text-muted-foreground">
                EEO Responses ({responseRate}%)
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recentAudits.length}</p>
              <p className="text-sm text-muted-foreground">
                Recent Audit Events
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* EEO/OFCCP Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender */}
        <ReportCard title="Gender Distribution" data={genderData} total={eeoResponses.length} />
        {/* Race */}
        <ReportCard title="Race Distribution" data={raceData} total={eeoResponses.length} />
        {/* Ethnicity */}
        <ReportCard title="Ethnicity Distribution" data={ethnicityData} total={eeoResponses.length} />
        {/* Veteran Status */}
        <ReportCard title="Veteran Status" data={veteranData} total={eeoResponses.length} />
      </div>

      {/* GPlayer Rating & Data Management */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-1">
          GPlayer Rating & Data Management
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Manage candidate data in compliance with GPlayer Rating and data privacy
          regulations.
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard/settings/compliance/gdpr"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Candidate Data Deletion
          </Link>
          <Link
            href="/dashboard/settings/compliance/export"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data (CSV)
          </Link>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold">Audit Trail</h2>
          <p className="text-sm text-muted-foreground">
            Recent actions tracked for compliance
          </p>
        </div>
        {recentAudits.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No audit events recorded yet. Actions will be logged as users
            interact with the system.
          </div>
        ) : (
          <div className="divide-y">
            {recentAudits.map((audit) => (
              <div key={audit.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                      {audit.action}
                    </span>
                    {audit.entityType && (
                      <span className="text-muted-foreground ml-2">
                        on {audit.entityType}
                        {audit.entityId && ` #${audit.entityId.slice(0, 8)}`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {audit.actorEmail || "System"} &bull;{" "}
                    {new Date(audit.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  title,
  data,
  total,
}: {
  title: string;
  data: { label: string; count: number; percentage: string }[];
  total: number;
}) {
  const barColors = [
    "bg-info",
    "bg-success",
    "bg-warning",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
  ];

  return (
    <div className="bg-card rounded-xl border p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data collected yet.</p>
      ) : (
        <div className="space-y-3">
          {data.map((item, idx) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="capitalize">{item.label.toLowerCase()}</span>
                <span className="text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`${barColors[idx % barColors.length]} h-2 rounded-full transition-all`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
