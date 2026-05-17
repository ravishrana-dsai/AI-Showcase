"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, X, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface OpenJob {
  id: string;
  title: string;
  department: { name: string } | null;
}

interface Props {
  candidateId: string;
  existingJobIds: string[];
}

export function AddToJobDialog({ candidateId, existingJobIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<OpenJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingJobs(true);
    setSelectedJobId("");
    setSuccessMessage("");
    setErrorMessage("");
    fetch(getApiUrl("/api/jobs/open"))
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OpenJob[]) => setJobs(data))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [open]);

  const availableJobs = jobs.filter((j) => !existingJobIds.includes(j.id));

  async function handleSubmit() {
    if (!selectedJobId) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const res = await fetch(getApiUrl("/api/candidates/add-to-job"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, jobId: selectedJobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add candidate to job");
      }
      const jobTitle = data.application?.job?.title ?? "";
      const stageName = data.application?.currentStage?.name ?? "";
      setSuccessMessage(
        `Added to ${jobTitle} — first stage: ${stageName}`
      );
      setTimeout(() => {
        setOpen(false);
        setSuccessMessage("");
        router.refresh();
      }, 1500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setSuccessMessage("");
    setErrorMessage("");
    setSelectedJobId("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <GitBranch className="w-3.5 h-3.5" />
        Add to Job
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="relative w-full max-w-md rounded-xl border bg-card shadow-xl mx-4">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b">
              <div>
                <h2 className="text-base font-semibold">Add to Job Pipeline</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Select an open job to add this candidate to the first pipeline stage.
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="ml-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {successMessage ? (
                <p className="text-sm text-green-600 font-medium">{successMessage}</p>
              ) : (
                <>
                  {loadingJobs ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading jobs...
                    </div>
                  ) : availableJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This candidate has already applied to all open jobs.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="job-select"
                        className="text-sm font-medium"
                      >
                        Job
                      </label>
                      <select
                        id="job-select"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={submitting}
                      >
                        <option value="">Select a job...</option>
                        {availableJobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                            {job.department ? ` — ${job.department.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {errorMessage && (
                    <p className="text-sm text-destructive">{errorMessage}</p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!successMessage && (
              <div className="flex items-center justify-end gap-2 px-5 pb-5">
                <button
                  onClick={handleClose}
                  disabled={submitting}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || loadingJobs || !selectedJobId}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Add to Pipeline
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
