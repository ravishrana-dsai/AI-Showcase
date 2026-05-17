"use client";

import { ReactNode } from "react";
import { Loader2, CheckCircle2, SkipForward, RefreshCw, Play } from "lucide-react";

export type StepStatus = "idle" | "running" | "needs_review" | "approved" | "skipped";

interface StepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
  disabled: boolean;
  onRun: () => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onSkip: () => void;
  children?: ReactNode; // output content
  approveLabel?: string;
}

const statusConfig: Record<StepStatus, { label: string; className: string }> = {
  idle: { label: "Not started", className: "bg-muted text-muted-foreground" },
  running: { label: "Running...", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  needs_review: { label: "Needs review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
};

export function StepCard({
  stepNumber,
  title,
  description,
  status,
  disabled,
  onRun,
  onApprove,
  onRegenerate,
  onSkip,
  children,
  approveLabel = "Approve",
}: StepCardProps) {
  const { label, className: badgeClass } = statusConfig[status];
  const isDone = status === "approved" || status === "skipped";

  return (
    <div
      className={`rounded-xl border bg-card transition-opacity ${
        disabled ? "opacity-40 pointer-events-none" : ""
      } ${isDone ? "border-border" : "border-border"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isDone
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-primary/10 text-primary"
            }`}
          >
            {status === "approved" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : status === "skipped" ? (
              <SkipForward className="h-4 w-4" />
            ) : (
              stepNumber
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
            {status === "running" ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                {label}
              </span>
            ) : (
              label
            )}
          </span>

          {status === "idle" && (
            <button
              onClick={onRun}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Play className="h-3 w-3" />
              Run
            </button>
          )}

          {status === "needs_review" && (
            <>
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </button>
              <button
                onClick={onSkip}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                Skip
              </button>
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <CheckCircle2 className="h-3 w-3" />
                {approveLabel}
              </button>
            </>
          )}

          {status === "running" && (
            <button
              onClick={onSkip}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Output area */}
      {children && (
        <div className="border-t px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
