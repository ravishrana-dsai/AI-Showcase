"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface CandidateExportButtonProps {
  candidateId: string;
  candidateName: string;
}

export function CandidateExportButton({ candidateId, candidateName }: CandidateExportButtonProps) {
  const [loading, setLoading] = useState<"json" | "csv" | null>(null);

  async function handleExport(format: "json" | "csv") {
    setLoading(format);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${candidateId}/export?format=${format}`));
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `candidate-${candidateName.replace(/\s+/g, "-")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleExport("json")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Download className="h-3.5 w-3.5" />
        {loading === "json" ? "Exporting..." : "JSON"}
      </button>
      <button
        type="button"
        onClick={() => handleExport("csv")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Download className="h-3.5 w-3.5" />
        {loading === "csv" ? "Exporting..." : "CSV"}
      </button>
    </div>
  );
}
