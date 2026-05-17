"use client";

import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api";

interface Job {
  id: string;
  title: string;
}

interface Department {
  id: string;
  name: string;
}

export interface AnalyticsFilters {
  jobId: string;
  departmentId: string;
  dateFrom: string;
  dateTo: string;
}

interface AnalyticsFiltersProps {
  onChange: (filters: AnalyticsFilters) => void;
  showJobFilter?: boolean;
  showDepartmentFilter?: boolean;
}

export function AnalyticsFiltersBar({
  onChange,
  showJobFilter = true,
  showDepartmentFilter = false,
}: AnalyticsFiltersProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    jobId: "",
    departmentId: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    if (showJobFilter) {
      fetch(getApiUrl("/api/jobs/open"))
        .then((r) => r.json())
        .then((data) => setJobs(data.jobs ?? []))
        .catch(() => {});
    }
    if (showDepartmentFilter) {
      fetch(getApiUrl("/api/departments"))
        .then((r) => r.json())
        .then((data) => setDepartments(data.departments ?? []))
        .catch(() => {});
    }
  }, [showJobFilter, showDepartmentFilter]);

  function update(patch: Partial<AnalyticsFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {showJobFilter && (
        <select
          value={filters.jobId}
          onChange={(e) => update({ jobId: e.target.value })}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">All Jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      )}
      {showDepartmentFilter && (
        <select
          value={filters.departmentId}
          onChange={(e) => update({ departmentId: e.target.value })}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => update({ dateFrom: e.target.value })}
        className="border rounded-md px-3 py-2 text-sm bg-white"
        placeholder="From"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => update({ dateTo: e.target.value })}
        className="border rounded-md px-3 py-2 text-sm bg-white"
        placeholder="To"
      />
      {(filters.jobId || filters.departmentId || filters.dateFrom || filters.dateTo) && (
        <button
          onClick={() => {
            const cleared = { jobId: "", departmentId: "", dateFrom: "", dateTo: "" };
            setFilters(cleared);
            onChange(cleared);
          }}
          className="text-sm text-gray-500 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
