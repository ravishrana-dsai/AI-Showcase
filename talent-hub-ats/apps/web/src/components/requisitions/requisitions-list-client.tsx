"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Approval {
  id: string;
  order: number;
  approver: { name: string | null };
}

interface Requisition {
  id: string;
  title: string;
  status: string;
  priority: string;
  headcount: number;
  createdAt: string;
  approvals: Approval[];
  _count: { jobs: number };
}

interface RequisitionsListClientProps {
  requisitions: Requisition[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  FILLED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",      // P3
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    // P2
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", // P1
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",      // P0
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "P0",
  HIGH: "P1",
  MEDIUM: "P2",
  LOW: "P3",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "OPEN", label: "Open" },
  { value: "FILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All Priorities" },
  { value: "LOW", label: "P3 - Low" },
  { value: "MEDIUM", label: "P2 - Medium" },
  { value: "HIGH", label: "P1 - High" },
  { value: "CRITICAL", label: "P0 - Critical" },
];

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function RequisitionsListClient({ requisitions }: RequisitionsListClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return requisitions.filter((req) => {
      if (query && !req.title.toLowerCase().includes(query)) return false;
      if (statusFilter && req.status !== statusFilter) return false;
      if (priorityFilter && req.priority !== priorityFilter) return false;
      return true;
    });
  }, [requisitions, search, statusFilter, priorityFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border">
        {filtered.length === 0 ? (
          requisitions.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No requisitions yet</h3>
              <p className="text-muted-foreground mt-1">
                Create a requisition to start the hiring approval process.
              </p>
              <Link
                href="/dashboard/requisitions/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Requisition
              </Link>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No requisitions match your filters</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
            </div>
          )
        ) : (
          <div className="divide-y">
            {filtered.map((req) => (
              <Link
                key={req.id}
                href={`/dashboard/requisitions/${req.id}`}
                className="block p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold">{req.title}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] ?? "bg-gray-100"}`}
                      >
                        {formatStatus(req.status)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[req.priority] ?? "bg-gray-100"}`}
                      >
                        {PRIORITY_LABELS[req.priority] ?? req.priority}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Headcount: {req.headcount} &bull; {req._count.jobs} linked job{req._count.jobs !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground shrink-0">
                    <p>Created {formatDate(req.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
