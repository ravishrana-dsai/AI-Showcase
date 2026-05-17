"use client";

import { CheckCircle2, Clock, XCircle, SkipForward, Loader2 } from "lucide-react";
import { cn, formatDate, formatDuration, getSlaStatus } from "@/lib/utils";
import type { RequestStageLog, PipelineStage } from "@/types";

type StageLogWithStage = RequestStageLog & { stage: PipelineStage };

const statusIcon = {
  COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  IN_PROGRESS: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  SKIPPED: <SkipForward className="h-4 w-4 text-gray-400" />,
  PENDING: <Clock className="h-4 w-4 text-gray-300" />,
};

interface StageTimelineProps {
  stageLogs: StageLogWithStage[];
}

export function StageTimeline({ stageLogs }: StageTimelineProps) {
  const sorted = [...stageLogs].sort((a, b) => a.stage.stageOrder - b.stage.stageOrder);

  return (
    <ol className="relative border-l border-gray-200 ml-3 space-y-6">
      {sorted.map((log, i) => {
        const slaStatus = getSlaStatus(
          log.startedAt,
          log.completedAt,
          Number(log.stage.slaHours)
        );
        const duration = log.durationMin ? Number(log.durationMin) : null;

        return (
          <li key={log.id} className="ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
              {statusIcon[log.status]}
            </span>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{log.stage.displayName}</span>
                <div className="flex items-center gap-2">
                  {slaStatus === "breached" && log.status !== "COMPLETED" && (
                    <span className="text-xs font-medium text-red-600">SLA Breached</span>
                  )}
                  {slaStatus === "warning" && log.status !== "COMPLETED" && (
                    <span className="text-xs font-medium text-yellow-600">SLA Warning</span>
                  )}
                  {duration && (
                    <span className="text-xs text-gray-500">{formatDuration(duration)}</span>
                  )}
                </div>
              </div>
              {log.startedAt && (
                <p className="mt-0.5 text-xs text-gray-400">
                  Started: {formatDate(log.startedAt)}
                  {log.completedAt && ` · Completed: ${formatDate(log.completedAt)}`}
                </p>
              )}
              {log.errorMessage && (
                <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  {log.errorMessage}
                </p>
              )}
              {log.updatedBy && (
                <p className="mt-0.5 text-xs text-gray-400">Updated by: {log.updatedBy}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
