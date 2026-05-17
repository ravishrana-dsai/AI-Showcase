"use client";

import { useState, useEffect } from "react";
import { Briefcase, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  status: string;
  department: { name: string } | null;
}

interface Props {
  candidateId: string;
  existingJobIds: string[];
}

export function ApplyToJobButton({ candidateId, existingJobIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || jobs.length > 0) return;
    setLoading(true);
    fetch(getApiUrl("/api/v1/jobs"))
      .catch(() => null)
      .then(async () => {
        // Use internal jobs endpoint
        const res = await fetch(getApiUrl("/api/jobs-list"));
        if (res.ok) return res.json();
        return { data: [] };
      })
      .then((data) => setJobs(data?.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, jobs.length]);

  // Fetch open jobs from public or internal listing
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(getApiUrl("/api/search?q="))
      .then(async (r) => {
        // Fallback: fetch all open jobs via a simple endpoint
        const res = await fetch(getApiUrl("/api/jobs/list"));
        if (res.ok) return res.json();
        return [];
      })
      .catch(() => [])
      .finally(() => setLoading(false));
  }, [open]);

  async function applyToJob(job: Job) {
    setApplying(true);
    try {
      const res = await fetch(getApiUrl("/api/applications/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, jobId: job.id, source: "Internal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Added to ${job.title}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        <Briefcase className="h-3.5 w-3.5" />
        Apply to job
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-sm font-medium">Apply to a job</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <JobPicker
            candidateId={candidateId}
            existingJobIds={existingJobIds}
            onApply={applyToJob}
            applying={applying}
          />
        </div>
      )}
    </div>
  );
}

function JobPicker({
  candidateId,
  existingJobIds,
  onApply,
  applying,
}: {
  candidateId: string;
  existingJobIds: string[];
  onApply: (job: Job) => void;
  applying: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(getApiUrl("/api/jobs/open"))
      .then((r) => (r.ok ? r.json() : []))
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(
    (j) =>
      !existingJobIds.includes(j.id) &&
      j.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="p-2 border-b">
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs…"
          className="w-full rounded-md bg-muted/50 px-2 py-1.5 text-sm focus-visible:outline-none"
        />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <div className="px-4 py-3 text-sm text-muted-foreground">Loading jobs…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            No open jobs available.
          </div>
        )}
        {!loading &&
          filtered.map((job) => (
            <button
              key={job.id}
              onClick={() => onApply(job)}
              disabled={applying}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors disabled:opacity-60"
            >
              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{job.title}</p>
                {job.department && (
                  <p className="text-xs text-muted-foreground truncate">
                    {job.department.name}
                  </p>
                )}
              </div>
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-auto" />
            </button>
          ))}
      </div>
    </>
  );
}
