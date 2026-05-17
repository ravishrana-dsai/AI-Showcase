"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  Plus,
  Link2,
  FileText,
  CheckCircle,
  AlertCircle,
  List,
  CalendarDays,
  Search,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { ScheduleInterviewModal } from "./schedule-interview-modal";
import { getApiUrl } from "@/lib/api";
import { InterviewsCalendar } from "./interviews-calendar";
import { CalendarDailyView } from "./calendar-daily-view";
import { CalendarMonthlyView } from "./calendar-monthly-view";

interface Interview {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink?: string | null;
  application: { id: string; candidate: { id: string; firstName: string; lastName: string; email: string }; job: { title: string } };
  panelists: { user: { id: string; name: string | null; email: string } }[];
  scorecards: { reviewerId: string; overallRating: string; recommendation: string | null; submittedAt: string }[];
}

interface ApplicationOption {
  id: string;
  candidate: { firstName: string; lastName: string };
  job: { title: string };
}

const typeIcons: Record<string, typeof Video> = {
  VIDEO: Video,
  PHONE: Phone,
  IN_PERSON: MapPin,
  TAKE_HOME: Clock,
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "VIDEO", label: "Video" },
  { value: "PHONE", label: "Phone" },
  { value: "IN_PERSON", label: "In Person" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "CULTURAL", label: "Cultural" },
  { value: "HR", label: "HR" },
  { value: "TAKE_HOME", label: "Take Home" },
];

type Tab = "upcoming" | "past";
type ViewMode = "table" | "calendar";
type CalendarView = "daily" | "weekly" | "monthly";

function getMondayOfCurrentWeek(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function InterviewsPageClient({ upcoming, past, canSchedule = true }: { upcoming: Interview[]; past: Interview[]; canSchedule?: boolean }) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [currentWeek, setCurrentWeek] = useState<Date>(getMondayOfCurrentWeek);
  const [showModal, setShowModal] = useState(false);
  const [apps, setApps] = useState<ApplicationOption[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationOption | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [calendarView, setCalendarView] = useState<CalendarView>("weekly");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  const allInterviews = useMemo(() => [...upcoming, ...past], [upcoming, past]);

  const tabInterviews = tab === "upcoming" ? upcoming : past;

  const filteredInterviews = useMemo(() => {
    const query = search.toLowerCase().trim();
    return tabInterviews.filter((iv) => {
      const name = `${iv.application.candidate.firstName} ${iv.application.candidate.lastName}`.toLowerCase();
      if (query && !name.includes(query) && !iv.title.toLowerCase().includes(query)) return false;
      if (statusFilter && iv.status !== statusFilter) return false;
      if (typeFilter && iv.type !== typeFilter) return false;
      return true;
    });
  }, [tabInterviews, search, statusFilter, typeFilter]);

  useEffect(() => {
    if (showModal && !selectedApp) {
      setLoadingApps(true);
      fetch(getApiUrl("/api/applications/active"))
        .then((r) => r.json())
        .then((d) => setApps(d.applications ?? []))
        .catch(() => setApps([]))
        .finally(() => setLoadingApps(false));
    }
  }, [showModal, selectedApp]);

  const handlePrevWeek = () => {
    setCurrentWeek((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeek((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 1);
      return next;
    });
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDay = (date: Date) => {
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    setCalendarView("daily");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Interviews</h1>
          <p className="text-muted-foreground mt-1">Upcoming and past interviews</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border bg-card p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-violet-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "calendar"
                  ? "bg-violet-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Calendar view"
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>

          {canSchedule && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Schedule Interview
            </button>
          )}
        </div>
      </div>

      {/* Application selection modal */}
      {showModal && !selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-xl border shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Select Application</h3>
            {loadingApps ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active applications.</p>
            ) : (
              <select
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                value=""
                onChange={(e) => {
                  const found = apps.find((x) => x.id === e.target.value);
                  if (found) setSelectedApp(found);
                }}
              >
                <option value="">Choose an application...</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.candidate.firstName} {a.candidate.lastName} | {a.job.title}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showModal && selectedApp && (
        <ScheduleInterviewModal
          applicationId={selectedApp.id}
          jobTitle={selectedApp.job.title}
          candidateName={`${selectedApp.candidate.firstName} ${selectedApp.candidate.lastName}`}
          onClose={() => { setShowModal(false); setSelectedApp(null); }}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Calendar view */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Calendar view toggle */}
          <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5 w-fit">
            {(["daily", "weekly", "monthly"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => {
                  if (view === "daily") {
                    // Jump to the nearest interview date if today has none
                    const todayDate = new Date();
                    const hasToday = allInterviews.some((iv) => {
                      const d = new Date(iv.scheduledAt);
                      return d.getFullYear() === todayDate.getFullYear() &&
                        d.getMonth() === todayDate.getMonth() &&
                        d.getDate() === todayDate.getDate();
                    });
                    if (!hasToday && allInterviews.length > 0) {
                      // Find the closest future interview, or fallback to the most recent
                      const sorted = [...allInterviews].sort(
                        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
                      );
                      const future = sorted.find((iv) => new Date(iv.scheduledAt) >= todayDate);
                      const target = future ?? sorted[sorted.length - 1];
                      const targetDate = new Date(target.scheduledAt);
                      setCurrentDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
                    }
                  }
                  setCalendarView(view);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                  calendarView === view
                    ? "bg-violet-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {view}
              </button>
            ))}
          </div>

          {calendarView === "daily" && (
            <CalendarDailyView
              interviews={allInterviews}
              currentDate={currentDate}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
            />
          )}

          {calendarView === "weekly" && (
            <InterviewsCalendar
              interviews={allInterviews}
              weekStart={currentWeek}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
            />
          )}

          {calendarView === "monthly" && (
            <CalendarMonthlyView
              interviews={allInterviews}
              currentMonth={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSelectDay={handleSelectDay}
            />
          )}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
            <button
              type="button"
              onClick={() => setTab("upcoming")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === "upcoming"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Upcoming
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px]",
                  tab === "upcoming"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {upcoming.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("past")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === "past"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Past
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px]",
                  tab === "past"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {past.length}
              </span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by candidate name..."
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
              {filteredInterviews.length} result{filteredInterviews.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Interview list */}
          <div className="bg-card rounded-xl border">
            {filteredInterviews.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {tabInterviews.length === 0
                    ? tab === "upcoming"
                      ? "No upcoming interviews"
                      : "No past interviews"
                    : "No interviews match your filters"}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {tabInterviews.length === 0
                    ? tab === "upcoming"
                      ? "Interviews will appear here once scheduled."
                      : "Completed or cancelled interviews appear here."
                    : "Try adjusting your search or filter criteria."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredInterviews.map((interview) => {
                  const TypeIcon = typeIcons[interview.type] ?? Calendar;
                  const candidateId = interview.application.candidate.id;
                  const reviewerIds = new Set(interview.scorecards.map((s) => s.reviewerId));
                  const allFeedbackIn =
                    interview.panelists.length === 0 ||
                    interview.panelists.every((p) => reviewerIds.has(p.user.id));
                  const isDone = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(interview.status);

                  return (
                    <div key={interview.id} className="p-5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center mt-0.5 shrink-0">
                            <TypeIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold">{interview.title}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {interview.application.candidate.firstName}{" "}
                              {interview.application.candidate.lastName}{" "}
                              &bull; {interview.application.job.title}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {interview.durationMinutes} min
                              </span>
                              {interview.meetingLink && (
                                <a
                                  href={interview.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-info hover:underline"
                                >
                                  <Link2 className="w-3.5 h-3.5" />
                                  Join meeting
                                </a>
                              )}
                            </div>
                            {interview.panelists.length > 0 && (
                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <span className="text-muted-foreground font-medium">Interviewers and feedback:</span>
                                {interview.panelists.map((p) => {
                                  const hasFeedback = reviewerIds.has(p.user.id);
                                  return (
                                    <span
                                      key={p.user.id}
                                      className={hasFeedback ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
                                    >
                                      {hasFeedback ? (
                                        <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                                      ) : (
                                        <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                                      )}
                                      {p.user.name ?? p.user.email}
                                      {hasFeedback ? " (done)" : " (pending)"}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm shrink-0 flex flex-col items-end gap-2">
                          <p className="font-medium">{formatDateTime(interview.scheduledAt)}</p>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isDone ? "bg-muted text-muted-foreground" : "bg-info/10 text-info"}`}
                          >
                            {isDone ? "Done" : "Pending"}
                          </span>
                          {!allFeedbackIn && isDone && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                              <AlertCircle className="w-3.5 h-3.5" /> Feedback pending
                            </span>
                          )}
                          {allFeedbackIn && isDone && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                              <CheckCircle className="w-3.5 h-3.5" /> All feedback in
                            </span>
                          )}
                          <Link
                            href={`/dashboard/candidates/${candidateId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View candidate
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
