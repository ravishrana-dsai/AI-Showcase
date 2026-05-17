"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Briefcase, MapPin, Clock, Users, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { JOB_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@talent-hub/shared";
import { EmptyState } from "@/components/ui/empty-state";

interface Job {
  id: string;
  title: string;
  status: string;
  employmentType: string;
  createdAt: string;
  department: { name: string } | null;
  location: { name: string } | null;
  hiringManager: { name: string | null } | null;
  _count: { applications: number };
}

interface JobsListClientProps {
  jobs: Job[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ON_HOLD: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ARCHIVED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "ARCHIVED", label: "Archived" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "FREELANCE", label: "Freelance" },
];

export function JobsListClient({ jobs }: JobsListClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return jobs.filter((job) => {
      if (query && !job.title.toLowerCase().includes(query)) return false;
      if (statusFilter && job.status !== statusFilter) return false;
      if (employmentTypeFilter && job.employmentType !== employmentTypeFilter) return false;
      return true;
    });
  }, [jobs, search, statusFilter, employmentTypeFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={employmentTypeFilter}
          onChange={(e) => setEmploymentTypeFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {filtered.length === 0 ? (
          jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-7 w-7" />}
              title="No jobs yet"
              description="Create your first job posting to start receiving applications."
              action={
                <Link
                  href="/dashboard/jobs/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Create Job
                </Link>
              }
            />
          ) : (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No jobs match your filters</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
            </div>
          )
        ) : (
          <div className="divide-y">
            {filtered.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="block p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold">{job.title}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] ?? "bg-gray-100"}`}
                      >
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      {job.department && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          {job.department.name}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {EMPLOYMENT_TYPE_LABELS[job.employmentType] ?? job.employmentType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {job._count.applications} candidate{job._count.applications !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground shrink-0">
                    <p>Created {formatDate(job.createdAt)}</p>
                    {job.hiringManager?.name && (
                      <p className="mt-0.5">HM: {job.hiringManager.name}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
