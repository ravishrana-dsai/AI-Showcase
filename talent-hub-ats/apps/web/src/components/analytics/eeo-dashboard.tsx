"use client";

import { useState, useEffect } from "react";
import { EeoChartCard } from "./eeo-chart-card";
import { getApiUrl } from "@/lib/api";

interface Job {
  id: string;
  title: string;
}

interface EeoData {
  totalResponses: number;
  totalCandidates: number;
  responseRate: number;
  gender: { label: string; count: number; percentage: number }[];
  race: { label: string; count: number; percentage: number }[];
  ethnicity: { label: string; count: number; percentage: number }[];
  veteranStatus: { label: string; count: number; percentage: number }[];
  disabilityStatus: { label: string; count: number; percentage: number }[];
}

interface EeoDashboardProps {
  jobs: Job[];
}

export function EeoDashboard({ jobs }: EeoDashboardProps) {
  const [data, setData] = useState<EeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (jobId) params.set("jobId", jobId);
    if (dateFrom) params.set("dateFrom", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) params.set("dateTo", `${dateTo}T23:59:59.999Z`);

    fetch(getApiUrl(`/api/eeo/dashboard?${params.toString()}`))
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jobId, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Job</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="button"
          onClick={() => { setJobId(""); setDateFrom(""); setDateTo(""); }}
          className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.totalResponses}</p>
            <p className="text-xs text-muted-foreground">EEO Responses</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.totalCandidates}</p>
            <p className="text-xs text-muted-foreground">Total Candidates</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.responseRate}%</p>
            <p className="text-xs text-muted-foreground">Response Rate</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EeoChartCard title="Gender" data={data.gender} />
          <EeoChartCard title="Race" data={data.race} />
          <EeoChartCard title="Ethnicity" data={data.ethnicity} />
          <EeoChartCard title="Veteran Status" data={data.veteranStatus} />
          <EeoChartCard title="Disability Status" data={data.disabilityStatus} />
        </div>
      )}
    </div>
  );
}
