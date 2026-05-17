"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalyticsFiltersBar, type AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { TimeToHireChart } from "@/components/analytics/time-to-hire-chart";

export default function TimeToHirePage() {
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
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Time-to-Hire</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How long it takes to move candidates from application to hire
          </p>
        </div>
      </div>

      <AnalyticsFiltersBar
        onChange={setFilters}
        showJobFilter
        showDepartmentFilter
      />

      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-6">Time-to-Hire Breakdown</h2>
        <TimeToHireChart filters={filters} />
      </div>
    </div>
  );
}
