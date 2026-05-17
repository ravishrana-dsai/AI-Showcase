"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface CandidateData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
}

interface MergeCandidatesDialogProps {
  existingCandidate: CandidateData & { id: string };
  newCandidateData: CandidateData;
  onSuccess?: (primaryId: string) => void;
  onClose: () => void;
}

export function MergeCandidatesDialog({
  existingCandidate,
  newCandidateData,
  onSuccess,
  onClose,
}: MergeCandidatesDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleMerge() {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/candidates/merge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryId: existingCandidate.id,
          duplicateId: newCandidateData.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Merge failed");

      toast.success("Candidates merged successfully");
      router.push(`/dashboard/candidates/${existingCandidate.id}`);
      onSuccess?.(existingCandidate.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Merge Candidates
        </h2>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
          The existing candidate record will be kept. All data (applications, notes, documents)
          from the new record will be merged into it.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border-2 border-green-400 bg-green-50 p-4 dark:bg-green-950/30">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
              Keep (existing)
            </p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {existingCandidate.firstName} {existingCandidate.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{existingCandidate.email}</p>
            {existingCandidate.currentTitle && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {existingCandidate.currentTitle}
              </p>
            )}
          </div>

          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:bg-red-950/30">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Merge into above
            </p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {newCandidateData.firstName} {newCandidateData.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{newCandidateData.email}</p>
            {newCandidateData.currentTitle && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {newCandidateData.currentTitle}
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          All applications, notes, and documents from both records will be combined.
          Blank fields in the existing record will be filled from the new record.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={loading}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Merging..." : "Confirm Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}
