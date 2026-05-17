"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { CandidateExportButton } from "@/components/compliance/candidate-export-button";
import { getApiUrl } from "@/lib/api";

interface CandidateResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export default function GdprDeletionPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CandidateResult | null>(
    null
  );
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setCandidates([]);

    try {
      const res = await fetch(
        getApiUrl(`/api/candidates/search?q=${encodeURIComponent(searchQuery)}`)
      );
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || confirmText !== deleteTarget.email) return;
    setIsDeleting(true);

    try {
      const res = await fetch(getApiUrl(`/api/candidates/${deleteTarget.id}/delete`), {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        setDeleteResult(data.message);
        setCandidates((prev) =>
          prev.filter((c) => c.id !== deleteTarget.id)
        );
        setDeleteTarget(null);
        setConfirmText("");
      } else {
        setDeleteResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setDeleteResult("Deletion failed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/settings/compliance"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Compliance
      </Link>

      <div>
        <h1 className="text-2xl font-bold">GPlayer Rating Data Deletion</h1>
        <p className="text-muted-foreground mt-1">
          Permanently delete all data associated with a candidate in compliance
          with GPlayer Rating &quot;Right to Erasure&quot; (Article 17).
        </p>
      </div>

      {/* Warning */}
      <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">
              This action is permanent and irreversible
            </p>
            <p className="text-muted-foreground mt-1">
              Deleting a candidate will permanently remove all their data
              including: profile information, applications, interview records,
              scorecards, offers, documents, notes, activity history, and EEO
              responses. An audit log entry will be created for compliance
              records.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border p-5">
        <h2 className="text-sm font-semibold mb-3">
          Search for candidate to delete
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        {/* Results */}
        {candidates.length > 0 && (
          <div className="mt-4 divide-y border rounded-lg">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {candidate.firstName} {candidate.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CandidateExportButton candidateId={candidate.id} candidateName={`${candidate.firstName} ${candidate.lastName}`} />
                  <button
                    onClick={() => setDeleteTarget(candidate)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deletion Confirmation Modal */}
      {deleteTarget && (
        <div className="bg-card rounded-xl border p-5 border-destructive/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">
              Confirm Deletion
            </h2>
          </div>
          <p className="text-sm mb-4">
            You are about to permanently delete all data for{" "}
            <strong>
              {deleteTarget.firstName} {deleteTarget.lastName}
            </strong>{" "}
            ({deleteTarget.email}).
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Type the candidate&apos;s email address to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={deleteTarget.email}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive mb-4"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={
                isDeleting || confirmText !== deleteTarget.email
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Permanently Delete
            </button>
            <button
              onClick={() => {
                setDeleteTarget(null);
                setConfirmText("");
              }}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {deleteResult && (
        <div
          className={`p-4 rounded-xl border ${
            deleteResult.startsWith("Error")
              ? "border-destructive/30 bg-destructive/5"
              : "border-success/30 bg-success/5"
          }`}
        >
          <div className="flex items-center gap-2">
            {deleteResult.startsWith("Error") ? (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
            <p className="text-sm">{deleteResult}</p>
          </div>
        </div>
      )}
    </div>
  );
}
