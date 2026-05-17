"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Loader2, X, ArrowRight } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { EXPERIENCE_LEVEL_LABELS, APPLICATION_STATUS_LABELS } from "@talent-hub/shared";

interface FilterOptions {
  sources: string[];
  jobs: { id: string; title: string }[];
  stages: string[];
  tags: { id: string; name: string; color: string | null }[];
}

interface AdvancedFilters {
  source: string;
  jobId: string;
  experienceLevel: string;
  stage: string;
  status: string;
  tags: string[];
  addedAfter: string;
  addedBefore: string;
}

interface EnrichedApplication {
  id: string;
  status: string;
  job: { id: string; title: string; experienceLevel: string | null };
  currentStage: { name: string };
}

interface EnrichedCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentTitle: string | null;
  currentCompany: string | null;
  source: string | null;
  createdAt: string;
  applications: EnrichedApplication[];
  tags: { tag: { id: string; name: string; color: string | null } }[];
}

const EMPTY_FILTERS: AdvancedFilters = {
  source: "",
  jobId: "",
  experienceLevel: "",
  stage: "",
  status: "",
  tags: [],
  addedAfter: "",
  addedBefore: "",
};

function countActiveFilters(f: AdvancedFilters): number {
  return [f.source, f.jobId, f.experienceLevel, f.stage, f.status, f.addedAfter, f.addedBefore]
    .filter(Boolean).length + f.tags.length;
}

export function AdvancedSearchPanel({
  query,
  onClose,
  onFilterCountChange,
}: {
  query: string;
  onClose: () => void;
  onFilterCountChange: (count: number) => void;
}) {
  const router = useRouter();
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<EnrichedCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load filter options on mount
  useEffect(() => {
    fetch(getApiUrl("/api/search/filter-options"))
      .then((r) => r.json())
      .then(setFilterOptions)
      .catch(() => {})
      .finally(() => setOptionsLoading(false));
  }, []);

  // Notify parent of active filter count
  useEffect(() => {
    onFilterCountChange(countActiveFilters(filters));
  }, [filters, onFilterCountChange]);

  // Search when query or filters change
  const doSearch = useCallback(async (q: string, f: AdvancedFilters) => {
    const hasFilter = countActiveFilters(f) > 0;
    if (q.length < 2 && !hasFilter) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (f.source) params.set("source", f.source);
      if (f.jobId) params.set("jobId", f.jobId);
      if (f.experienceLevel) params.set("experienceLevel", f.experienceLevel);
      if (f.stage) params.set("stage", f.stage);
      if (f.status) params.set("status", f.status);
      if (f.tags.length > 0) params.set("tags", f.tags.join(","));
      if (f.addedAfter) params.set("addedAfter", f.addedAfter);
      if (f.addedBefore) params.set("addedBefore", f.addedBefore);
      // Add a sentinel so the API enters advanced mode even with only text query
      if (!hasFilter) params.set("source", "__advanced__");

      const res = await fetch(getApiUrl(`/api/search?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        // Filter out the sentinel hack result
        setResults(data.candidates ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, filters), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, doSearch]);

  // Close on backdrop click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function setFilter<K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(id: string) {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(id)
        ? prev.tags.filter((t) => t !== id)
        : [...prev.tags, id],
    }));
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
  }

  function navigateTo(path: string) {
    onClose();
    router.push(path);
  }

  const activeCount = countActiveFilters(filters);
  const experienceLevelEntries = Object.entries(EXPERIENCE_LEVEL_LABELS);
  const statusEntries = Object.entries(APPLICATION_STATUS_LABELS);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 top-14 z-50 mx-auto max-w-4xl px-4"
      >
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          {/* Filter rows */}
          <div className="border-b px-4 py-3 space-y-3 bg-muted/30">
            {/* Row 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Source */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilter("source", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={optionsLoading}
                >
                  <option value="">All sources</option>
                  {filterOptions?.sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Job */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Job</label>
                <select
                  value={filters.jobId}
                  onChange={(e) => setFilter("jobId", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={optionsLoading}
                >
                  <option value="">All jobs</option>
                  {filterOptions?.jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              {/* Experience Level */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Level</label>
                <select
                  value={filters.experienceLevel}
                  onChange={(e) => setFilter("experienceLevel", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All levels</option>
                  {experienceLevelEntries.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Pipeline Stage */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Stage</label>
                <select
                  value={filters.stage}
                  onChange={(e) => setFilter("stage", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={optionsLoading}
                >
                  <option value="">All stages</option>
                  {filterOptions?.stages.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Application Status */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilter("status", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">All statuses</option>
                  {statusEntries.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Added After */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Added after</label>
                <input
                  type="date"
                  value={filters.addedAfter}
                  onChange={(e) => setFilter("addedAfter", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Added Before */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Added before</label>
                <input
                  type="date"
                  value={filters.addedBefore}
                  onChange={(e) => setFilter("addedBefore", e.target.value)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Clear all */}
              <div className="flex items-end">
                {activeCount > 0 && (
                  <button
                    onClick={clearAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Tags row */}
            {filterOptions && filterOptions.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Tags:</span>
                {filterOptions.tags.map((tag) => {
                  const active = filters.tags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all"
                      style={
                        active
                          ? {
                              backgroundColor: `${tag.color || "#6B7280"}30`,
                              borderColor: tag.color || "#6B7280",
                              color: tag.color || undefined,
                            }
                          : undefined
                      }
                    >
                      {active && <X className="mr-1 h-2.5 w-2.5" />}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[55vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            )}

            {!loading && results === null && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Type to search or apply filters to find candidates.
              </div>
            )}

            {!loading && results !== null && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No candidates match your search.
              </div>
            )}

            {!loading && results && results.length > 0 && (
              <ul className="divide-y">
                {results.map((c) => {
                  const activeApp = c.applications.find((a) => a.status === "ACTIVE") ?? c.applications[0];
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => navigateTo(`/dashboard/candidates/${c.id}`)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              {c.firstName} {c.lastName}
                            </span>
                            {c.source && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {c.source}
                              </span>
                            )}
                            {c.tags.slice(0, 3).map(({ tag }) => (
                              <span
                                key={tag.id}
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{
                                  backgroundColor: `${tag.color || "#6B7280"}20`,
                                  color: tag.color || undefined,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.currentTitle
                              ? `${c.currentTitle}${c.currentCompany ? ` · ${c.currentCompany}` : ""}`
                              : c.email}
                          </p>
                          {activeApp && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground">{activeApp.job.title}</span>
                              {" · "}
                              <span>{activeApp.currentStage.name}</span>
                              {" · "}
                              <span className="capitalize">{activeApp.status.toLowerCase()}</span>
                            </p>
                          )}
                        </div>
                        <User className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {results !== null ? `${results.length} candidate${results.length !== 1 ? "s" : ""}` : ""}
            </span>
            <button
              onClick={() => navigateTo("/dashboard/candidates")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              View all in Candidates
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
