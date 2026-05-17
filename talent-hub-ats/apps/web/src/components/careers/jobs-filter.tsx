"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { JobCard } from "./job-card";
import { EMPLOYMENT_TYPE_LABELS } from "@talent-hub/shared";

interface Job {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  organization?: string | null;
}

interface JobsFilterProps {
  jobs: Job[];
}

const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as Array<
  keyof typeof EMPLOYMENT_TYPE_LABELS
>;

export function JobsFilter({ jobs }: JobsFilterProps) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchesQuery =
        query.trim() === "" ||
        job.title.toLowerCase().includes(query.trim().toLowerCase()) ||
        (job.department ?? "")
          .toLowerCase()
          .includes(query.trim().toLowerCase());

      const matchesType =
        selectedType === "all" || job.employmentType === selectedType;

      return matchesQuery && matchesType;
    });
  }, [jobs, query, selectedType]);

  const hasActiveFilters =
    query.trim() !== "" || selectedType !== "all";

  function clearFilters() {
    setQuery("");
    setSelectedType("all");
  }

  return (
    <div>
      {/* Search + filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or department..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
          />
        </div>

        {/* Filter toggle (mobile) + inline selects (desktop) */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-violet-500" />
            )}
          </button>
        </div>

        {/* Desktop: inline selects */}
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition cursor-pointer"
          >
            <option value="all">All types</option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {filtersOpen && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:hidden">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Employment type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All types</option>
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EMPLOYMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <p className="mb-4 text-sm text-muted-foreground">
        {filtered.length === jobs.length
          ? `${jobs.length} open position${jobs.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${jobs.length} position${jobs.length === 1 ? "" : "s"} match`}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
            <Search className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No matches found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters to find what you are looking
            for.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              id={job.id}
              title={job.title}
              department={job.department}
              location={job.location}
              employmentType={job.employmentType}
              organization={job.organization}
            />
          ))}
        </div>
      )}
    </div>
  );
}
