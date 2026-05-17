"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MergeCandidatesDialog } from "./merge-candidates-dialog";
import type { DuplicateMatch } from "@/lib/candidates/duplicate-detection";

interface DuplicateDetectionBannerProps {
  duplicates: DuplicateMatch[];
  newCandidateData?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  onMergeSuccess?: (primaryId: string) => void;
  onDismiss: () => void;
}

export function DuplicateDetectionBanner({
  duplicates,
  newCandidateData,
  onMergeSuccess,
  onDismiss,
}: DuplicateDetectionBannerProps) {
  const [mergeTarget, setMergeTarget] = useState<DuplicateMatch | null>(null);

  if (duplicates.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Potential duplicate{duplicates.length > 1 ? "s" : ""} found
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
              {duplicates.length} existing candidate{duplicates.length > 1 ? "s" : ""} match this profile.
              You can view them, merge, or continue creating a new record.
            </p>

            <div className="mt-3 space-y-2">
              {duplicates.map((match) => (
                <div
                  key={match.candidate.id}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 shadow-sm dark:bg-gray-900"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {match.candidate.firstName} {match.candidate.lastName}
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                        {match.confidence === "EXACT" ? "Exact match" : "Probable match"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {match.candidate.email}
                      {match.candidate.currentTitle && ` · ${match.candidate.currentTitle}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/candidates/${match.candidate.id}`}
                      target="_blank"
                      className="rounded text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </Link>
                    {newCandidateData && (
                      <button
                        type="button"
                        onClick={() => setMergeTarget(match)}
                        className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        Merge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="mt-3 text-xs text-amber-700 underline hover:no-underline dark:text-amber-300"
            >
              Ignore and create anyway
            </button>
          </div>
        </div>
      </div>

      {mergeTarget && newCandidateData && (
        <MergeCandidatesDialog
          existingCandidate={mergeTarget.candidate}
          newCandidateData={newCandidateData}
          onSuccess={(primaryId) => {
            setMergeTarget(null);
            onMergeSuccess?.(primaryId);
          }}
          onClose={() => setMergeTarget(null)}
        />
      )}
    </>
  );
}
