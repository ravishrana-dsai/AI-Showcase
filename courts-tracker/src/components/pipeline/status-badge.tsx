import { cn } from "@/lib/utils";
import type { RequestStatus, StageLogStatus, CourtStatus } from "@/types";

const requestStatusConfig: Record<RequestStatus, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-gray-100 text-gray-600" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  COMPLETED:   { label: "Completed",   className: "bg-green-100 text-green-700" },
  FAILED:      { label: "Failed",      className: "bg-red-100 text-red-700" },
  CANCELLED:   { label: "Cancelled",   className: "bg-gray-100 text-gray-500" },
};

const stageLogStatusConfig: Record<StageLogStatus, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-gray-100 text-gray-500" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  COMPLETED:   { label: "Done",        className: "bg-green-100 text-green-700" },
  FAILED:      { label: "Failed",      className: "bg-red-100 text-red-700" },
  SKIPPED:     { label: "Skipped",     className: "bg-yellow-100 text-yellow-700" },
};

const courtStatusConfig: Record<CourtStatus, { label: string; className: string }> = {
  ACTIVE:      { label: "Active",      className: "bg-green-100 text-green-700" },
  INACTIVE:    { label: "Inactive",    className: "bg-gray-100 text-gray-500" },
  ONBOARDING:  { label: "Onboarding",  className: "bg-blue-100 text-blue-700" },
  SUSPENDED:   { label: "Suspended",   className: "bg-red-100 text-red-700" },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const cfg = requestStatusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.className)}>
      {cfg.label}
    </span>
  );
}

export function StageStatusBadge({ status }: { status: StageLogStatus }) {
  const cfg = stageLogStatusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.className)}>
      {cfg.label}
    </span>
  );
}

export function CourtStatusBadge({ status }: { status: CourtStatus }) {
  const cfg = courtStatusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.className)}>
      {cfg.label}
    </span>
  );
}

export function SlaBadge({ breached }: { breached: boolean }) {
  return breached ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      SLA Breached
    </span>
  ) : null;
}
