"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

export function PublishJobButton({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const canPublish = ["DRAFT", "PENDING_APPROVAL"].includes(status);
  const isOpen = status === "OPEN";

  const handlePublish = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "OPEN" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (canPublish) {
    return (
      <button
        type="button"
        onClick={handlePublish}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        Publish to career site
      </button>
    );
  }

  if (isOpen) {
    return (
      <button
        type="button"
        onClick={handleUnpublish}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        Unpublish
      </button>
    );
  }

  return null;
}
