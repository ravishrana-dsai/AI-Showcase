"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  OPEN: "Open",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ON_HOLD: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ARCHIVED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const ALL_STATUSES = ["DRAFT", "PENDING_APPROVAL", "OPEN", "CLOSED", "ON_HOLD", "ARCHIVED"];

export function JobStatusSelect({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      toast.success(`Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-flex items-center gap-1.5">
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}
