"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { AnalyticsFilters } from "./analytics-filters";
import { getApiUrl } from "@/lib/api";

interface TimeToHireData {
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  byJob: Array<{
    jobId: string;
    jobTitle: string;
    avg: number;
    count: number;
  }>;
}

interface TimeToHireChartProps {
  filters: AnalyticsFilters;
}

const COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#ef4444", "#f97316", "#eab308",
];

export function TimeToHireChart({ filters }: TimeToHireChartProps) {
  const [data, setData] = useState<TimeToHireData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.jobId) params.set("jobId", filters.jobId);
    if (filters.departmentId) params.set("departmentId", filters.departmentId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    setLoading(true);
    fetch(getApiUrl(`/api/analytics/time-to-hire?${params}`))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters.jobId, filters.departmentId, filters.dateFrom, filters.dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!data || data.avg === null) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No hiring data for the selected filters.
      </div>
    );
  }

  const chartData = data.byJob.slice(0, 10).map((item) => ({
    name: item.jobTitle.length > 20 ? item.jobTitle.slice(0, 18) + "..." : item.jobTitle,
    days: item.avg,
    count: item.count,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Average", value: data.avg },
          { label: "Median", value: data.median },
          { label: "Fastest", value: data.min },
          { label: "Slowest", value: data.max },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {value !== null ? value : "-"}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label} days</div>
          </div>
        ))}
      </div>

      {chartData.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">By Job</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit=" d" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={130}
              />
              <Tooltip
                formatter={(value: any) => [`${value} days`, "Avg. time to hire"]}
              />
              <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
