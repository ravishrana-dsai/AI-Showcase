"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface CreateJobButtonProps {
  requisitionId: string;
  requisitionStatus: string;
  hasLinkedJob: boolean;
}

export function CreateJobButton({ requisitionId, requisitionStatus, hasLinkedJob }: CreateJobButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (requisitionStatus !== "APPROVED" || hasLinkedJob) return null;

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${requisitionId}/create-job`), {
        method: "POST",
      });
      const data = (await res.json()) as { job?: { id: string; title: string }; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Failed to create job");

      toast.success(`Job "${data.job?.title}" created as Draft`);
      router.push(`/dashboard/jobs/${data.job?.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCreate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      Create Job
    </button>
  );
}
