"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { isSameDay, formatTime, TYPE_COLORS } from "./calendar-utils";

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
  scorecards: {
    reviewerId: string;
    overallRating: string;
    recommendation: string | null;
    submittedAt: string;
  }[];
}

interface CalendarDailyViewProps {
  interviews: Interview[];
  currentDate: Date;
  onPrevDay: () => void;
  onNextDay: () => void;
}

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CalendarDailyView({
  interviews,
  currentDate,
  onPrevDay,
  onNextDay,
}: CalendarDailyViewProps) {
  const today = useMemo(() => new Date(), []);
  const isToday = isSameDay(currentDate, today);

  const dayInterviews = useMemo(() => {
    return interviews
      .filter((iv) => isSameDay(new Date(iv.scheduledAt), currentDate))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [interviews, currentDate]);

  // Dynamically expand hour range to include all interview times
  const hourSlots = useMemo(() => {
    let startHour = DEFAULT_START_HOUR;
    let endHour = DEFAULT_END_HOUR;
    for (const iv of dayInterviews) {
      const hour = new Date(iv.scheduledAt).getHours();
      if (hour < startHour) startHour = hour;
      if (hour >= endHour) endHour = hour + 1;
    }
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);
  }, [dayInterviews]);

  const interviewsByHour = useMemo(() => {
    const grouped = new Map<number, Interview[]>();
    for (const hour of hourSlots) {
      grouped.set(hour, []);
    }
    for (const iv of dayInterviews) {
      const hour = new Date(iv.scheduledAt).getHours();
      const existing = grouped.get(hour);
      if (existing) {
        grouped.set(hour, [...existing, iv]);
      }
    }
    return grouped;
  }, [dayInterviews, hourSlots]);

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrevDay}
          className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span
          className={`text-sm font-medium min-w-[260px] text-center ${
            isToday ? "text-violet-600 dark:text-violet-400" : ""
          }`}
        >
          {formatDateLabel(currentDate)}
          {isToday && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500 text-white">
              Today
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onNextDay}
          className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>{dayInterviews.length} interview{dayInterviews.length !== 1 ? "s" : ""} scheduled</span>
      </div>

      {/* Time slot grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {hourSlots.map((hour) => {
          const slotInterviews = interviewsByHour.get(hour) ?? [];
          const currentHour = new Date().getHours();
          const isCurrentHour = isToday && hour === currentHour;

          return (
            <div
              key={hour}
              className={`flex border-b last:border-b-0 min-h-[56px] ${
                isCurrentHour ? "bg-violet-50/50 dark:bg-violet-950/20" : ""
              }`}
            >
              {/* Hour label */}
              <div className="w-20 shrink-0 px-3 py-2 text-xs text-muted-foreground font-medium border-r bg-muted/30 flex items-start pt-2.5">
                {formatHourLabel(hour)}
              </div>

              {/* Interview cards for this hour */}
              <div className="flex-1 p-1.5 flex flex-wrap gap-1.5">
                {slotInterviews.map((iv) => {
                  const typeBadge =
                    TYPE_COLORS[iv.type] ??
                    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                  const candidateName = `${iv.application.candidate.firstName} ${iv.application.candidate.lastName}`;

                  return (
                    <Link
                      key={iv.id}
                      href={`/dashboard/interviews/${iv.id}`}
                      className="flex-1 min-w-[200px] max-w-md rounded-lg border bg-card p-2.5 hover:bg-muted/50 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight">
                            {formatTime(iv.scheduledAt)} ({iv.durationMinutes}{" "}
                            min)
                          </p>
                          <p className="text-sm font-medium text-foreground truncate mt-0.5">
                            {candidateName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {iv.application.job.title}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeBadge}`}
                        >
                          {iv.type.replace(/_/g, " ")}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
