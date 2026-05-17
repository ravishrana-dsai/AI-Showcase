"use client";

interface PipelineStageSummary {
  name: string;
  count: number;
  minOrder: number;
}

interface OverallPipelineBarProps {
  stages: PipelineStageSummary[];
}

export function OverallPipelineBar({ stages }: OverallPipelineBarProps) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 0);

  if (total === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Overall Pipeline
        </h3>
        <span className="text-sm text-muted-foreground">
          {total} active candidate{total !== 1 ? "s" : ""} across all jobs
        </span>
      </div>

      {/* Proportional bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg bg-muted/30">
        {stages.map((stage) => {
          const widthPct = total > 0 ? (stage.count / total) * 100 : 0;
          if (widthPct === 0) return null;

          const isMax = stage.count === maxCount;

          return (
            <div
              key={stage.name}
              className={`relative flex items-center justify-center text-xs font-semibold transition-all ${
                isMax
                  ? "bg-violet-500 text-white"
                  : "bg-violet-200/60 text-violet-900 dark:bg-violet-800/40 dark:text-violet-200"
              }`}
              style={{ width: `${Math.max(widthPct, 4)}%` }}
              title={`${stage.name}: ${stage.count}`}
            >
              {widthPct > 8 && (
                <span className="truncate px-1">{stage.count}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage legend */}
      <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const isMax = stage.count === maxCount && stage.count > 0;

          return (
            <div key={stage.name} className="flex items-center shrink-0">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  isMax
                    ? "bg-violet-500/10 border-violet-500/40 text-violet-700 dark:text-violet-300"
                    : "bg-muted/40 border-transparent text-muted-foreground"
                }`}
              >
                <span className="whitespace-nowrap">{stage.name}</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isMax
                      ? "bg-violet-500/20 text-violet-700 dark:text-violet-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stage.count}
                </span>
              </div>
              {index < stages.length - 1 && (
                <svg className="w-3 h-3 text-muted-foreground/40 mx-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
