"use client";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface AuditLogFiltersProps {
  users: User[];
  filters: {
    actorId: string;
    action: string;
    entityType: string;
    dateFrom: string;
    dateTo: string;
  };
  onChange: (key: string, value: string) => void;
  onReset: () => void;
}

const ENTITY_TYPES = [
  "Candidate",
  "Application",
  "Job",
  "Offer",
  "Interview",
  "User",
  "Organization",
  "ApiKey",
  "Webhook",
];

export function AuditLogFilters({ users, filters, onChange, onReset }: AuditLogFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">User</label>
        <select
          value={filters.actorId}
          onChange={(e) => onChange("actorId", e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
        <input
          type="text"
          value={filters.action}
          onChange={(e) => onChange("action", e.target.value)}
          placeholder="e.g. candidate.created"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Entity Type</label>
        <select
          value={filters.entityType}
          onChange={(e) => onChange("entityType", e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">From Date</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange("dateFrom", e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 min-w-[140px]">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">To Date</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange("dateTo", e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        Reset
      </button>
    </div>
  );
}
