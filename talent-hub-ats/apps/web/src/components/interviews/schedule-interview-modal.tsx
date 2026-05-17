"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Loader2, CalendarDays, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

interface ScheduleInterviewModalProps {
  applicationId: string;
  jobTitle: string;
  candidateName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getDefaultTimezone() {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }
  return "UTC";
}

export function ScheduleInterviewModal({ applicationId, jobTitle, candidateName, onClose, onSuccess }: ScheduleInterviewModalProps) {
  const [schedulingMethod, setSchedulingMethod] = useState<"manual" | "google_calendar">("manual");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("VIDEO");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [timezone, setTimezone] = useState(getDefaultTimezone);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedPanelistIds, setSelectedPanelistIds] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/users"))
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/interviews/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          title: title.trim(),
          type,
          scheduledAt,
          durationMinutes,
          meetingLink: meetingLink.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          timezone: timezone?.trim() || "UTC",
          panelistIds: selectedPanelistIds,
          skipCalendarSync: schedulingMethod === "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule interview");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card rounded-xl border shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-card rounded-t-xl">
          <h2 className="text-lg font-semibold">Schedule Interview</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{candidateName} | {jobTitle}</p>

          {/* Scheduling method */}
          <div>
            <label className="block text-sm font-medium mb-2">Scheduling method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSchedulingMethod("manual")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  schedulingMethod === "manual"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <PenLine className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Manual</p>
                  <p className="text-xs font-normal opacity-70">No calendar invite sent</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSchedulingMethod("google_calendar")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  schedulingMethod === "google_calendar"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-xs font-normal opacity-70">Sends calendar invite</p>
                </div>
              </button>
            </div>
            {schedulingMethod === "google_calendar" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Requires Google Calendar to be connected in Settings. If not configured, the interview will still be saved.
              </p>
            )}
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Technical Interview" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="VIDEO">Video</option>
              <option value="PHONE">Phone</option>
              <option value="IN_PERSON">In Person</option>
              <option value="TAKE_HOME">Take Home</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date & Time</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Duration</label>
              <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {[30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Meeting Link (optional)</label>
            <input type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Location (optional)</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office or address" className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {!COMMON_TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Interviewers (name / email)</label>
            <p className="text-xs text-muted-foreground mb-1.5">Choose who will interview the candidate. They will see this in My Interviews and can submit feedback.</p>
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground">Loading team...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users in your organization.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-background p-2 space-y-1.5">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedPanelistIds.includes(u.id)}
                      onChange={(e) => setSelectedPanelistIds((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))}
                      className="rounded border-input"
                    />
                    <span>{u.name || u.email}</span>
                    {u.name && <span className="text-muted-foreground">({u.email})</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Additional details..." className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={cn("flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2")}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Scheduling...</> : <><Calendar className="w-4 h-4" />Schedule</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
