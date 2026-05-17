"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalyticsFiltersBar, type AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { PipelineFunnelChart } from "@/components/analytics/pipeline-funnel-chart";

export default function PipelineFunnelPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    jobId: "",
    departmentId: "",
    dateFrom: "",
    dateTo: "",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/analytics"
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Funnel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Stage-by-stage conversion rates and drop-off analysis
          </p>
        </div>
      </div>

      <AnalyticsFiltersBar
        onChange={setFilters}
        showJobFilter
        showDepartmentFilter={false}
      />

      {!filters.jobId && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          Select a specific job above to see its pipeline funnel, or view aggregated data across all jobs.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Candidate Flow by Stage
        </h2>
        <PipelineFunnelChart filters={filters} />
      </div>
    </div>
  );
}
