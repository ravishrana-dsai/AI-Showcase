"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Users, UserPlus, Upload, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { BulkActionsBar } from "./bulk-actions-bar";
import { getApiUrl } from "@/lib/api";

type Application = {
  id: string;
  status: string;
  job: { id: string; title: string };
  currentStage: { name: string };
};

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentTitle: string | null;
  currentCompany: string | null;
  source: string | null;
  createdAt: string;
  isArchived: boolean;
  applications: Application[];
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type Tab = "active" | "rejected" | "pool" | "archived";

export function CandidatesList({ candidates }: { candidates: Candidate[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  const sources = useMemo(
    () =>
      Array.from(
        new Set(candidates.map((c) => c.source).filter(Boolean) as string[])
      ).sort(),
    [candidates]
  );

  const activeCandidates = useMemo(
    () => candidates.filter((c) => !c.isArchived && c.applications.some((a) => a.status === "ACTIVE")),
    [candidates]
  );

  const rejectedCandidates = useMemo(
    () =>
      candidates.filter(
        (c) =>
          !c.isArchived &&
          c.applications.some((a) => a.status === "REJECTED") &&
          !c.applications.some((a) => a.status === "ACTIVE")
      ),
    [candidates]
  );

  const poolCandidates = useMemo(
    () => candidates.filter((c) => !c.isArchived && c.applications.length === 0),
    [candidates]
  );

  const archivedCandidates = useMemo(
    () => candidates.filter((c) => c.isArchived),
    [candidates]
  );

  const tabCandidates: Record<Tab, Candidate[]> = {
    active: activeCandidates,
    rejected: rejectedCandidates,
    pool: poolCandidates,
    archived: archivedCandidates,
  };

  const filtered = useMemo(() => {
    const base = tabCandidates[tab];
    return base.filter((c) => {
      const matchSearch =
        !search ||
        `${c.firstName} ${c.lastName} ${c.email}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchSource = !sourceFilter || c.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [tabCandidates, tab, search, sourceFilter]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(
      selectedIds.size === filtered.length
        ? new Set()
        : new Set(filtered.map((c) => c.id))
    );

  async function handleUnarchive(candidateId: string) {
    setUnarchivingId(candidateId);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${candidateId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to unarchive candidate");
      }
      window.location.reload();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Something went wrong");
      setUnarchivingId(null);
    }
  }

  async function handleRestore(applicationId: string) {
    setRestoringId(applicationId);
    setRestoreError(null);
    try {
      const res = await fetch(getApiUrl(`/api/applications/${applicationId}/restore`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to restore application");
      }
      window.location.reload();
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setRestoringId(null);
    }
  }

  const tabConfig: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeCandidates.length },
    { key: "rejected", label: "Rejected", count: rejectedCandidates.length },
    { key: "pool", label: "Talent Pool", count: poolCandidates.length },
    { key: "archived", label: "Archived", count: archivedCandidates.length },
  ];

  const currentCandidates = tabCandidates[tab];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {tabConfig.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setSelectedIds(new Set());
              setRestoreError(null);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {label}
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px]",
                tab === key
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Restore error banner */}
      {restoreError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {restoreError}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">
              {currentCandidates.length === 0
                ? tab === "active"
                  ? "No active candidates"
                  : tab === "rejected"
                  ? "No rejected candidates"
                  : tab === "archived"
                  ? "No archived candidates"
                  : "No candidates in talent pool"
                : "No candidates match your search"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              {currentCandidates.length === 0
                ? "Add candidates manually or bulk upload resumes to get started."
                : "Try a different search or clear filters."}
            </p>
            {currentCandidates.length === 0 && tab === "active" && (
              <div className="mt-6 flex flex-wrap gap-3 justify-center">
                <Link
                  href="/dashboard/candidates/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <UserPlus className="h-4 w-4" /> Add Candidate
                </Link>
                <Link
                  href="/dashboard/candidates/upload"
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Upload className="h-4 w-4" /> Bulk Upload CVs
                </Link>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === filtered.length && filtered.length > 0
                    }
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Candidate
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Current Role
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  {tab === "rejected" ? "Rejected from" : tab === "archived" ? "Last Application" : "Active Application"}
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Source
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Tags
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Added
                </th>
                {(tab === "rejected" || tab === "archived") && (
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => {
                const rejectedApps = c.applications.filter(
                  (a) => a.status === "REJECTED"
                );
                const activeApp = c.applications.find(
                  (a) => a.status === "ACTIVE"
                );
                const displayApp = tab === "rejected" ? rejectedApps[0] : tab === "archived" ? c.applications[0] : activeApp;

                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      selectedIds.has(c.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/candidates/${c.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {c.firstName[0]}
                          {c.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.email}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {c.currentTitle && (
                        <span>
                          {c.currentTitle}
                          {c.currentCompany && ` at ${c.currentCompany}`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {displayApp ? (
                        <div>
                          <p className="font-medium">{displayApp.job.title}</p>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted">
                            {displayApp.currentStage.name}
                          </span>
                          {tab === "rejected" && rejectedApps.length > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              +{rejectedApps.length - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {c.source || "--"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${tag.color || "#6B7280"}20`,
                              color: tag.color || undefined,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {formatRelativeTime(c.createdAt)}
                    </td>
                    {tab === "rejected" && (
                      <td className="px-5 py-3">
                        {rejectedApps[0] && (
                          <button
                            type="button"
                            disabled={restoringId === rejectedApps[0].id}
                            onClick={() => handleRestore(rejectedApps[0].id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {restoringId === rejectedApps[0].id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Move to pipeline
                          </button>
                        )}
                      </td>
                    )}
                    {tab === "archived" && (
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          disabled={unarchivingId === c.id}
                          onClick={() => handleUnarchive(c.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {unarchivingId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                          Unarchive
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedIds={Array.from(selectedIds)}
          onClear={() => setSelectedIds(new Set())}
          onActionComplete={() => window.location.reload()}
        />
      )}
    </div>
  );
}
