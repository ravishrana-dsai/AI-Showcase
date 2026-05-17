"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-green-500/10 text-green-600 dark:text-green-400",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const ALL_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];

export function RequisitionStatusSelect({
  requisitionId,
  status,
  onUpdate,
}: {
  requisitionId: string;
  status: string;
  onUpdate: (newStatus: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${requisitionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-status", status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      toast.success(`Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}`);
      onUpdate(newStatus);
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
