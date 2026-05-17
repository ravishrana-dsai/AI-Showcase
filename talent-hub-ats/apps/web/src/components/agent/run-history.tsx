"use client";

import { useEffect, useState } from "react";
import { History, ChevronDown, ChevronRight } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface RunRecord {
  id: string;
  step: string;
  status: string;
  createdAt: string;
  jobId: string;
  jobTitle: string;
  outputSnippet: string;
}

const STEP_LABELS: Record<string, string> = {
  jd_polish: "Polish JD",
  candidate_matching: "Match Candidates",
  email_drafting: "Draft Emails",
  interview_prep: "Interview Prep",
};

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  skipped: "bg-muted text-muted-foreground",
  regenerated: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface RunHistoryProps {
  jobId?: string;
}

export function RunHistory({ jobId }: RunHistoryProps) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const url = jobId
      ? getApiUrl(`/api/agent/history?jobId=${jobId}&limit=20`)
      : getApiUrl("/api/agent/history?limit=20");

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRuns(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading || runs.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-muted/40 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          Recent agent runs
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{runs.length}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {runs.map((run) => (
            <div key={run.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {STEP_LABELS[run.step] ?? run.step}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[run.status] ?? STATUS_COLORS.generated}`}>
                    {run.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="truncate max-w-[160px]">{run.jobTitle}</span>
                  <span>{timeAgo(run.createdAt)}</span>
                  {run.outputSnippet && (
                    <button
                      onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                      className="text-primary hover:underline"
                    >
                      {expanded === run.id ? "hide" : "preview"}
                    </button>
                  )}
                </div>
              </div>
              {expanded === run.id && run.outputSnippet && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-4 font-mono whitespace-pre-wrap">
                  {run.outputSnippet}…
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
