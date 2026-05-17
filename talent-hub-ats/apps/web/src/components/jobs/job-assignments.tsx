"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  title: string | null;
}

interface Assignment {
  id: string;
  userId: string;
  assignedAt: string;
  user: AssignedUser;
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export function JobAssignments({
  jobId,
  userRole,
}: {
  jobId: string;
  userRole: string;
}) {
  const canManage = ["ADMIN", "SUPER_ADMIN", "RECRUITER"].includes(userRole);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subRecruiters, setSubRecruiters] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}/assignments`));
      if (!res.ok) throw new Error("Failed to load assignments");
      const data = await res.json();
      setAssignments(data.assignments ?? []);
    } catch {
      toast.error("Failed to load assigned sub-recruiters");
    }
  }, [jobId]);

  const fetchSubRecruiters = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/users"));
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      const users = (data.users ?? data ?? []) as OrgUser[];
      setSubRecruiters(users.filter((u) => u.role === "SUB_RECRUITER"));
    } catch {
      // Non-critical: user list may not load
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAssignments(), fetchSubRecruiters()]).finally(() =>
      setLoading(false)
    );
  }, [fetchAssignments, fetchSubRecruiters]);

  if (!canManage) return null;

  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const unassigned = subRecruiters.filter((u) => !assignedUserIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}/assignments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign");
      }
      toast.success("Sub-recruiter assigned");
      setSelectedUserId("");
      await fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign sub-recruiter");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}/assignments`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }
      toast.success("Sub-recruiter removed");
      await fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove assignment");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading assignments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
        <Users className="h-4 w-4" />
        Assigned Sub-recruiters
      </h2>

      {/* Current assignments */}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">
          No sub-recruiters assigned to this job yet.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {assignment.user.name || assignment.user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {assignment.user.email}
                  {assignment.user.title ? ` · ${assignment.user.title}` : ""}
                </p>
              </div>
              <button
                onClick={() => handleRemove(assignment.userId)}
                disabled={removingId === assignment.userId}
                className="ml-2 flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                title="Remove assignment"
              >
                {removingId === assignment.userId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      {unassigned.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select a sub-recruiter...</option>
            {unassigned.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email} ({u.email})
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedUserId || adding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </div>
      )}

      {unassigned.length === 0 && subRecruiters.length > 0 && assignments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          All sub-recruiters are assigned to this job.
        </p>
      )}

      {subRecruiters.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No sub-recruiter users found in your organization.
        </p>
      )}
    </div>
  );
}
