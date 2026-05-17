import Link from "next/link";
import { MapPin, Clock, ArrowRight, Building2 } from "lucide-react";
import { EMPLOYMENT_TYPE_LABELS } from "@talent-hub/shared";

interface JobCardProps {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  organization?: string | null;
}

function EmploymentBadge({ type }: { type: string }) {
  const label =
    EMPLOYMENT_TYPE_LABELS[type as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? type;

  const colorMap: Record<string, string> = {
    FULL_TIME:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    PART_TIME:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    CONTRACT:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    INTERNSHIP:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    TEMPORARY:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    FREELANCE:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  };

  const colorClass =
    colorMap[type] ??
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${colorClass}`}
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

export function JobCard({
  id,
  title,
  department,
  location,
  employmentType,
  organization,
}: JobCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700">
      {/* Top row: department tag */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {department && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {department}
            </span>
          )}
          {organization && !department && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {organization}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-3 text-lg font-semibold text-foreground leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
        {title}
      </h3>

      {/* Meta row */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {employmentType && <EmploymentBadge type={employmentType} />}
        {location && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto">
        <Link
          href={`/jobs/apply/${id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-violet-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Apply Now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
