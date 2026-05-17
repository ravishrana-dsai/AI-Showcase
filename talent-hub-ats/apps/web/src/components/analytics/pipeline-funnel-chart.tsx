"use client";

import { useState, useEffect } from "react";
import type { AnalyticsFilters } from "./analytics-filters";
import { getApiUrl } from "@/lib/api";

interface FunnelStage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  count: number;
  conversionRate: number | null;
  dropOffRate: number | null;
}

interface PipelineFunnelData {
  stages: FunnelStage[];
  jobTitle?: string;
}

interface PipelineFunnelChartProps {
  filters: AnalyticsFilters;
}

export function PipelineFunnelChart({ filters }: PipelineFunnelChartProps) {
  const [data, setData] = useState<PipelineFunnelData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.jobId) params.set("jobId", filters.jobId);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);

    setLoading(true);
    fetch(getApiUrl(`/api/analytics/pipeline-funnel?${params}`))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters.jobId, filters.dateFrom, filters.dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (!data || data.stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No pipeline data for the selected filters.
      </div>
    );
  }

  const maxCount = Math.max(...data.stages.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {data.stages.map((stage, i) => {
        const barWidth = Math.max((stage.count / maxCount) * 100, 2);
        const isLast = i === data.stages.length - 1;

        return (
          <div key={stage.stageId ?? `stage-${i}`}>
            <div className="flex items-center gap-3">
              <div className="w-32 text-sm text-gray-600 text-right truncate">
                {stage.stageName}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-3 transition-all"
                  style={{ width: `${barWidth}%` }}
                >
                  <span className="text-white text-xs font-medium whitespace-nowrap">
                    {stage.count}
                  </span>
                </div>
              </div>
            </div>
            {!isLast && stage.dropOffRate !== null && (
              <div className="flex items-center gap-3 my-1">
                <div className="w-32" />
                <div className="flex-1 flex items-center gap-2 text-xs text-gray-400">
                  <div className="h-4 border-l-2 border-dashed border-gray-300 ml-4" />
                  <span className="text-orange-500">
                    -{stage.dropOffRate}% drop-off
                  </span>
                  {stage.conversionRate !== null && (
                    <span className="text-green-600">
                      {stage.conversionRate}% advanced
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
