"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, MapPin, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { EMPLOYMENT_TYPE_LABELS } from "@talent-hub/shared";

interface Job {
  id: string;
  title: string;
  department: string;
  location: string | null;
  employmentType: string | null;
  orgSlug?: string | null;
  orgName?: string | null;
}

interface Props {
  jobs: Job[];
  /** When provided, job links use this org slug for /careers/[orgSlug]/jobs/[id]. */
  orgSlug?: string;
}

const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_LABELS) as Array<
  keyof typeof EMPLOYMENT_TYPE_LABELS
>;

export function JobsDepartmentList({ jobs, orgSlug }: Props) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        job.title.toLowerCase().includes(q) ||
        job.department.toLowerCase().includes(q) ||
        (job.orgName && job.orgName.toLowerCase().includes(q));

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

  // Group by department alphabetically
  const grouped = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of filtered) {
      const dept = job.department || "General";
      const existing = map.get(dept);
      if (existing) {
        existing.push(job);
      } else {
        map.set(dept, [job]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search roles or departments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          />
        </div>

        {/* Mobile filter toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
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
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          >
            <option value="all" className="bg-neutral-900 text-white">
              All types
            </option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type} className="bg-neutral-900 text-white">
                {EMPLOYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-white/40 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {filtersOpen && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:hidden">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              Employment type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-white/40 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <p className="mb-6 text-sm text-white/40">
        {filtered.length === jobs.length
          ? `${jobs.length} open position${jobs.length === 1 ? "" : "s"}`
          : `${filtered.length} of ${jobs.length} position${jobs.length === 1 ? "" : "s"} match`}
      </p>

      {/* Department groups */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20">
            <Search className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">No matches found</h3>
          <p className="text-sm text-white/40">
            Try adjusting your search or filters to find what you are looking for.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([dept, deptJobs]) => (
            <div key={dept}>
              {/* Department header */}
              <div className="mb-3 flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="text-base font-bold text-white">{dept}</span>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
                  {deptJobs.length}
                </span>
              </div>

              {/* Job rows */}
              <div className="divide-y divide-white/5">
                {deptJobs.map((job) => {
                  const typeLabel = job.employmentType
                    ? (EMPLOYMENT_TYPE_LABELS[
                        job.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS
                      ] ?? job.employmentType)
                    : null;

                  const slug = job.orgSlug?.trim() || orgSlug;
                  const applyHref = slug
                    ? `/careers/${slug}/jobs/${job.id}`
                    : `/jobs/apply/${job.id}`;

                  return (
                    <Link
                      key={job.id}
                      href={applyHref}
                      className="group flex items-center justify-between gap-4 rounded-xl px-4 py-4 transition hover:bg-white/5"
                    >
                      {/* Left: title + location */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white group-hover:text-violet-300 transition-colors">
                          {job.title}
                        </p>
                        {job.orgName && (
                          <p className="mt-0.5 truncate text-xs text-white/45">{job.orgName}</p>
                        )}
                        {job.location && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1 text-xs text-white/40">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {job.location}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: type + apply cue */}
                      <div className="flex flex-shrink-0 items-center gap-3">
                        {typeLabel && (
                          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 sm:inline-flex">
                            {typeLabel}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:text-violet-400 group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
