import { requirePermission } from "@/lib/get-session";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Users, Calendar } from "lucide-react";

export default async function ComplianceExportPage() {
  await requirePermission("settings.manage");

  const exports = [
    {
      id: "candidates",
      title: "Candidates Export",
      description:
        "Export all candidate profiles including contact details, source, current stage, and application history.",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      fields: "Name, Email, Phone, Location, Source, Company, Title, Tags, Applied At",
    },
    {
      id: "applications",
      title: "Applications Export",
      description:
        "Export all job applications with pipeline stage history, recruiter assignments, and status.",
      icon: FileText,
      color: "text-green-500",
      bg: "bg-green-500/10",
      fields: "Candidate, Job, Stage, Status, Recruiter, Applied At, Hired At",
    },
    {
      id: "interviews",
      title: "Interviews Export",
      description:
        "Export all scheduled and completed interviews with panelists, feedback scores, and outcomes.",
      icon: Calendar,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      fields: "Candidate, Job, Title, Type, Status, Scheduled At, Panelists",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/settings/compliance"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Compliance
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Export</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Export recruitment data as CSV for compliance reporting, audits, or
          data analysis. All exports include your organization&apos;s data only.
        </p>
      </div>

      <div className="grid gap-4">
        {exports.map((exp) => {
          const Icon = exp.icon;
          return (
            <div
              key={exp.id}
              className="rounded-xl border bg-card p-6 flex items-start gap-5"
            >
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${exp.bg}`}
              >
                <Icon className={`h-5 w-5 ${exp.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{exp.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {exp.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Columns:</span> {exp.fields}
                </p>
              </div>
              <a
                href={`/api/export?type=${exp.id}`}
                download
                className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </a>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-4">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Data retention notice:</strong> Exported files may contain
          personal data subject to GPlayer Rating and local privacy laws. Ensure exports
          are stored securely and deleted when no longer needed. For permanent
          candidate deletion, use the{" "}
          <Link
            href="/dashboard/settings/compliance/gdpr"
            className="underline hover:no-underline"
          >
            GPlayer Rating deletion tool
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
