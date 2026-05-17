"use client";

import { ChevronRight } from "lucide-react";

type Stage = {
  id: string;
  name: string;
  type: string;
  order: number;
};

type Application = {
  id: string;
  currentStageId: string;
};

interface PipelineStageBarProps {
  stages: Stage[];
  applications: Application[];
}

export function PipelineStageBar({ stages, applications }: PipelineStageBarProps) {
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  const countsByStage = sortedStages.reduce<Record<string, number>>(
    (acc, stage) => ({
      ...acc,
      [stage.id]: applications.filter((app) => app.currentStageId === stage.id).length,
    }),
    {}
  );

  const maxCount = Math.max(...Object.values(countsByStage), 0);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-3">
      {sortedStages.map((stage, index) => {
        const count = countsByStage[stage.id] ?? 0;
        const isAccent = count > 0 && count === maxCount;

        return (
          <div key={stage.id} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isAccent
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted/50 border-transparent text-muted-foreground"
              }`}
            >
              <span className="whitespace-nowrap">{stage.name}</span>
              <span
                className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isAccent
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </div>
            {index < sortedStages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
