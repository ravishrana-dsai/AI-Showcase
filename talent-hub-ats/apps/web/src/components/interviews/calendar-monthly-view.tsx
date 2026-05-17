"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { isSameDay, TYPE_COLORS, DAY_NAMES } from "./calendar-utils";

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

interface CalendarMonthlyViewProps {
  interviews: Interview[];
  currentMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  interviews: Interview[];
}

function buildCalendarGrid(
  month: Date,
  interviews: Interview[],
): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  // Monday = 0, Sunday = 6 (ISO-like week starting Monday)
  const startDayOfWeek =
    firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, monthIndex, -i);
    days.push({
      date,
      isCurrentMonth: false,
      interviews: interviews.filter((iv) =>
        isSameDay(new Date(iv.scheduledAt), date),
      ),
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, monthIndex, d);
    days.push({
      date,
      isCurrentMonth: true,
      interviews: interviews.filter((iv) =>
        isSameDay(new Date(iv.scheduledAt), date),
      ),
    });
  }

  // Next month padding to fill remaining cells (complete the last row)
  const remainder = days.length % 7;
  if (remainder > 0) {
    const daysToAdd = 7 - remainder;
    for (let i = 1; i <= daysToAdd; i++) {
      const date = new Date(year, monthIndex + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        interviews: interviews.filter((iv) =>
          isSameDay(new Date(iv.scheduledAt), date),
        ),
      });
    }
  }

  return days;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getUniqueInterviewTypes(interviews: Interview[]): string[] {
  const seen = new Set<string>();
  const types: string[] = [];
  for (const iv of interviews) {
    if (!seen.has(iv.type)) {
      seen.add(iv.type);
      types.push(iv.type);
    }
    if (types.length >= 3) break;
  }
  return types;
}

export function CalendarMonthlyView({
  interviews,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: CalendarMonthlyViewProps) {
  const today = useMemo(() => new Date(), []);

  const calendarDays = useMemo(
    () => buildCalendarGrid(currentMonth, interviews),
    [currentMonth, interviews],
  );

  const totalInterviews = useMemo(
    () =>
      interviews.filter((iv) => {
        const d = new Date(iv.scheduledAt);
        return (
          d.getFullYear() === currentMonth.getFullYear() &&
          d.getMonth() === currentMonth.getMonth()
        );
      }).length,
    [interviews, currentMonth],
  );

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevMonth}
            className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center">
            {formatMonthLabel(currentMonth)}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            className="p-2 rounded-lg border bg-card hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalInterviews} interview{totalInterviews !== 1 ? "s" : ""} this
          month
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((calDay, idx) => {
            const isCurrentDay = isSameDay(calDay.date, today);
            const hasInterviews = calDay.interviews.length > 0;
            const uniqueTypes = getUniqueInterviewTypes(calDay.interviews);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectDay(calDay.date)}
                className={`relative min-h-[80px] p-2 border-b border-r text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${
                  !calDay.isCurrentMonth ? "bg-muted/20" : ""
                } ${idx % 7 === 6 ? "border-r-0" : ""}`}
              >
                {/* Date number */}
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    isCurrentDay
                      ? "bg-violet-500 text-white ring-2 ring-violet-500/30"
                      : calDay.isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  }`}
                >
                  {calDay.date.getDate()}
                </span>

                {/* Interview indicators */}
                {hasInterviews && (
                  <div className="mt-1 space-y-1">
                    {/* Colored dots (up to 3) */}
                    <div className="flex items-center gap-0.5">
                      {uniqueTypes.map((type) => {
                        const colorClass =
                          TYPE_COLORS[type] ?? "bg-gray-300";
                        const dotColor =
                          colorClass.split(" ")[0] ?? "bg-gray-300";
                        return (
                          <span
                            key={type}
                            className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                          />
                        );
                      })}
                    </div>

                    {/* Count badge */}
                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {calDay.interviews.length}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state for the entire month */}
      {totalInterviews === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No interviews this month</h3>
          <p className="text-muted-foreground mt-1">
            Navigate to another month or schedule a new interview.
          </p>
        </div>
      )}
    </div>
  );
}
