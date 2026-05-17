"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface PublishRequisitionJobButtonProps {
  requisitionId: string;
  requisitionStatus: string;
  hasLinkedJob: boolean;
  onSuccess?: () => void;
}

export function PublishRequisitionJobButton({
  requisitionId,
  requisitionStatus,
  hasLinkedJob,
  onSuccess,
}: PublishRequisitionJobButtonProps) {
  const [loading, setLoading] = useState(false);

  const canPublish =
    hasLinkedJob || requisitionStatus === "APPROVED";

  if (!canPublish) return null;

  async function handlePublish() {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/requisitions/${requisitionId}/publish`), {
        method: "POST",
      });
      const data = (await res.json()) as { job?: { title: string }; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to publish");
      }

      toast.success(
        data.job?.title
          ? `"${data.job.title}" is now live on the careers site`
          : "Job published to careers site"
      );

      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Globe className="h-4 w-4" />
      )}
      Publish to Careers
    </button>
  );
}
