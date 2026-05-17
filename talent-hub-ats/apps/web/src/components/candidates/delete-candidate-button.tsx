"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface DeleteCandidateButtonProps {
  candidateId: string;
  candidateName: string;
}

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: DeleteCandidateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${candidateId}/delete`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete candidate");
      }
      router.push("/dashboard/candidates");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete candidate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative z-10 bg-card border rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-2">Delete candidate</h2>
            <p className="text-sm text-muted-foreground mb-1">
              You are about to permanently delete{" "}
              <span className="font-medium text-foreground">{candidateName}</span>.
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              This will remove all their applications, documents, notes, and
              interview history. This action cannot be undone.
            </p>

            {error && (
              <p className="text-sm text-destructive mb-4">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
