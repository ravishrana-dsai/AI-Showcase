"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { toast } from "sonner";

export function DeleteRequisitionButton({
  requisitionId,
  userRole,
}: {
  requisitionId: string;
  userRole: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) return null;

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${requisitionId}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete requisition");
        return;
      }
      toast.success("Requisition deleted");
      router.push("/dashboard/requisitions");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-destructive font-medium">Delete this requisition?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </button>
  );
}
