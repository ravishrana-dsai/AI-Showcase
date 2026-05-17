"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { isSameDay, formatTime, TYPE_COLORS, DAY_NAMES } from "./calendar-utils";

interface Interview {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  application: {
    id: string;
    candidate: { id: string; firstName: string; lastName: string; email: string };
    job: { title: string };
  };
  panelists: { user: { id: string; name: string | null; email: string } }[];
  scorecards: { reviewerId: string; overallRating: string; recommendation: string | null; submittedAt: string }[];
}

interface InterviewsCalendarProps {
  interviews: Interview[];
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = monday.toLocaleDateString("en-US", opts);
  const end = sunday.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${start} - ${end}`;
}


export function InterviewsCalendar({
  interviews,
  weekStart,
  onPrevWeek,
  onNextWeek,
}: InterviewsCalendarProps) {
  const monday = useMemo(() => getMondayOfWeek(weekStart), [weekStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  const interviewsByDay = useMemo(() => {
    return weekDays.map((day) => {
      const dayInterviews = interviews
        .filter((iv) => isSameDay(new Date(iv.scheduledAt), day))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      return { day, interviews: dayInterviews };
    });
  }, [weekDays, interviews]);

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          Week of {formatWeekLabel(monday)}
        </span>
        <button
          type="button"
          onClick={onNextWeek}
          className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 overflow-x-auto">
        {interviewsByDay.map(({ day, interviews: dayInterviews }, idx) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={idx} className="min-w-[120px] space-y-2">
              {/* Day header */}
              <div
                className={`rounded-lg px-2 py-2 text-center ${
                  isToday
                    ? "bg-violet-500 text-white"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <p className="text-xs font-medium">{DAY_NAMES[idx]}</p>
                <p className={`text-lg font-bold leading-none mt-0.5 ${isToday ? "text-white" : "text-foreground"}`}>
                  {day.getDate()}
                </p>
              </div>

              {/* Interview cards */}
              <div className="space-y-1.5">
                {dayInterviews.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-muted-foreground/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground/50">No interviews</p>
                  </div>
                ) : (
                  dayInterviews.map((iv) => {
                    const typeBadge = TYPE_COLORS[iv.type] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                    const candidateName = `${iv.application.candidate.firstName} ${iv.application.candidate.lastName}`;
                    return (
                      <Link
                        key={iv.id}
                        href={`/dashboard/interviews/${iv.id}`}
                        className="block rounded-lg border bg-card p-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                          {formatTime(iv.scheduledAt)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {candidateName}
                        </p>
                        <span className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge}`}>
                          {iv.type.replace(/_/g, " ")}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {interviews.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No interviews this week</h3>
          <p className="text-muted-foreground mt-1">Navigate to another week or schedule a new interview.</p>
        </div>
      )}
    </div>
  );
}
