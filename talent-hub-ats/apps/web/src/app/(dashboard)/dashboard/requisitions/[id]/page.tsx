"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Send,
  Loader2,
  BarChart2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateJobButton } from "@/components/requisitions/create-job-button";
import { RequisitionStatusSelect } from "@/components/requisitions/requisition-status-select";
import { DeleteRequisitionButton } from "@/components/requisitions/delete-requisition-button";
import { getApiUrl } from "@/lib/api";

interface Approver {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
}

interface Approval {
  id: string;
  approverId: string;
  approver: Approver;
  order: number;
  status: string;
  comment: string | null;
  decidedAt: string | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  _count: { applications: number };
}

interface Requisition {
  id: string;
  title: string;
  status: string;
  priority: string;
  headcount: number;
  level: string | null;
  justification: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  employmentType: string;
  createdAt: string;
  approvals: Approval[];
  jobs: Job[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-green-500/10 text-green-600 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  CRITICAL: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "P0",
  HIGH: "P1",
  MEDIUM: "P2",
  LOW: "P3",
};

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(userRole);
  const [req, setReq] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(getApiUrl(`/api/requisitions/${id}`))
      .then((r) => r.json())
      .then(setReq)
      .catch(() => toast.error("Failed to load requisition"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprovalAction(action: "APPROVED" | "REJECTED") {
    setActing(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === "APPROVED" ? "Requisition approved" : "Requisition rejected");
      const updated = await fetch(getApiUrl(`/api/requisitions/${id}`)).then((r) => r.json());
      setReq(updated);
      setComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.status === "APPROVED" ? "Requisition approved — you can now create a job" : "Requisition submitted for approval");
      const updated = await fetch(getApiUrl(`/api/requisitions/${id}`)).then((r) => r.json());
      setReq(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Requisition not found.
      </div>
    );
  }

  const pendingApproval = req.approvals.find((a) => a.status === "PENDING");
  const myPendingApproval = req.approvals.find((a) => a.status === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/requisitions" className="hover:text-foreground transition-colors flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Requisitions
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{req.title}</h1>
            {isAdmin ? (
              <RequisitionStatusSelect
                requisitionId={req.id}
                status={req.status}
                onUpdate={(newStatus) => setReq((prev) => prev ? { ...prev, status: newStatus } : prev)}
              />
            ) : (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[req.status] ?? "bg-muted text-muted-foreground"}`}>
                {req.status}
              </span>
            )}
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_COLORS[req.priority] ?? "bg-muted text-muted-foreground"}`}>
              {PRIORITY_LABELS[req.priority] ?? req.priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {format(new Date(req.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {req.status === "DRAFT" && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for Approval
            </button>
          )}
          <CreateJobButton
            requisitionId={req.id}
            requisitionStatus={req.status}
            hasLinkedJob={req.jobs.length > 0}
          />
          <DeleteRequisitionButton requisitionId={req.id} userRole={userRole} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-medium">Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Headcount</p>
                  <p className="font-medium">{req.headcount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Employment Type</p>
                  <p className="font-medium capitalize">
                    {req.employmentType.replace("_", " ").toLowerCase()}
                  </p>
                </div>
              </div>
              {req.level && (
                <div className="flex items-center gap-3 text-sm">
                  <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Level</p>
                    <p className="font-medium">Level {req.level}</p>
                  </div>
                </div>
              )}
            </div>
            {req.justification && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-1">Business Justification</p>
                <p className="text-sm whitespace-pre-wrap">{req.justification}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-medium">Approval Chain</h2>
            {req.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approvals configured.</p>
            ) : (
              <div className="space-y-3">
                {req.approvals.map((approval) => (
                  <div key={approval.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {approval.status === "APPROVED" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : approval.status === "REJECTED" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{approval.approver.name}</span>
                        <span className="text-xs text-muted-foreground">{approval.approver.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[approval.status] ?? ""}`}>
                          {approval.status}
                        </span>
                      </div>
                      {approval.comment && (
                        <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{approval.comment}&rdquo;</p>
                      )}
                      {approval.decidedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(approval.decidedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">Step {approval.order}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingApproval && myPendingApproval && req.status === "PENDING" && (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h2 className="font-medium">Take Action</h2>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment…"
                rows={3}
                className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprovalAction("APPROVED")}
                  disabled={acting}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleApprovalAction("REJECTED")}
                  disabled={acting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h2 className="font-medium">Linked Jobs</h2>
            {req.jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs linked yet.</p>
            ) : (
              <div className="space-y-3">
                {req.jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {job.status.toLowerCase()} · {job._count.applications} applicants
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
