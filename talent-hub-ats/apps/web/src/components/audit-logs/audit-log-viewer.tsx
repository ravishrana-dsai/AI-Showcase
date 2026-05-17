"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { AuditLogFilters } from "./audit-log-filters";
import { getApiUrl } from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  metadata: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface AuditLogViewerProps {
  initialUsers: User[];
}

const EMPTY_FILTERS = {
  actorId: "",
  action: "",
  entityType: "",
  dateFrom: "",
  dateTo: "",
};

export function AuditLogViewer({ initialUsers }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const limit = 50;

  const fetchLogs = useCallback(async (currentPage: number, currentFilters: typeof EMPTY_FILTERS) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
      if (currentFilters.actorId) params.set("actorId", currentFilters.actorId);
      if (currentFilters.action) params.set("action", currentFilters.action);
      if (currentFilters.entityType) params.set("entityType", currentFilters.entityType);
      if (currentFilters.dateFrom) params.set("dateFrom", `${currentFilters.dateFrom}T00:00:00.000Z`);
      if (currentFilters.dateTo) params.set("dateTo", `${currentFilters.dateTo}T23:59:59.999Z`);

      const res = await fetch(getApiUrl(`/api/audit-logs?${params.toString()}`));
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, filters);
  }, [fetchLogs, page, filters]);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <AuditLogFilters
        users={initialUsers}
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${total.toLocaleString()} events`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="divide-y">
          {logs.length === 0 && !loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No audit log entries found.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {log.action}
                    </span>
                    {log.entityType && (
                      <span className="text-xs text-muted-foreground">
                        {log.entityType}
                        {log.entityId && (
                          <span className="font-mono"> #{log.entityId.slice(-8)}</span>
                        )}
                      </span>
                    )}
                  </div>
                  {log.actorEmail && (
                    <p className="mt-0.5 text-xs text-muted-foreground">by {log.actorEmail}</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                </time>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
