export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock } from "lucide-react";
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "@talent-hub/shared";
import { sanitizeHtml } from "@/lib/sanitize";
import { fetchOrgJobDetail, fetchJobMeta, hiringPortalLogoSrc } from "@/lib/hiring-portal";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string; jobId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, jobId } = await params;
  const data = await fetchOrgJobDetail(slug, jobId);
  if (data?.job) {
    return {
      title: `${data.job.title} | ${data.job.organization?.name ?? "Careers"}`,
    };
  }
  const meta = await fetchJobMeta(jobId);
  return {
    title: meta ? `${meta.title} | ${meta.orgName ?? "Careers"}` : "Job | Careers",
  };
}

export default async function OrgJobDetailPage({ params }: PageProps) {
  const { slug, jobId } = await params;

  const data = await fetchOrgJobDetail(slug, jobId);
  if (!data) return notFound();

  const { organization: org, job } = data;
  if (!job || job.organization?.id !== org.id) return notFound();

  const primaryColor = org.careerPageConfig?.primaryColor ?? "#7c3aed";
  const logoSrc = hiringPortalLogoSrc(org.careerPageConfig?.logoUrl ?? null, null);

  const employmentLabel = job.employmentType
    ? (EMPLOYMENT_TYPE_LABELS[job.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? job.employmentType)
    : null;
  const experienceLabel = job.experienceLevel
    ? (EXPERIENCE_LEVEL_LABELS[job.experienceLevel as keyof typeof EXPERIENCE_LEVEL_LABELS] ?? job.experienceLevel)
    : null;

  const requirementLines = job.requirements
    ? job.requirements.split("\n").filter((line) => line.trim())
    : [];

  const descriptionIsHtml = job.description
    ? /<[a-z][\s\S]*>/i.test(job.description)
    : false;
  const descriptionLines = !descriptionIsHtml && job.description
    ? job.description.split("\n").filter((line) => line.trim())
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <nav className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${slug}`} className="flex items-center gap-2.5">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={org.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-base font-black text-foreground">{org.name}</span>
            )}
          </Link>
          <Link
            href={`/${slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            All positions
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Job header */}
        <div className="mb-8">
          {job.department?.name && (
            <span className="mb-3 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {job.department.name}
            </span>
          )}
          <h1 className="text-3xl font-bold text-foreground leading-snug">{job.title}</h1>
          {job.organization?.name && (
            <p className="mt-1 text-sm text-muted-foreground">{job.organization.name}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            {employmentLabel && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                {employmentLabel}
              </span>
            )}
            {experienceLabel && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="h-4 w-4 shrink-0 text-center text-xs font-bold" style={{ color: primaryColor }}>XP</span>
                {experienceLabel}
              </span>
            )}
            {job.location?.name && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                {job.location.name}
              </span>
            )}
          </div>
        </div>

        {/* Opening paragraph */}
        {job.openingParagraph && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm leading-relaxed text-foreground">{job.openingParagraph}</p>
          </div>
        )}

        {/* Description */}
        {job.description && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              About the role
            </h2>
            {descriptionIsHtml ? (
              <div
                className="text-sm text-foreground [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:leading-relaxed [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
              />
            ) : (
              <ul className="space-y-2.5">
                {descriptionLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primaryColor }} />
                    {line.replace(/^[-•]\s*/, "").trim()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Requirements */}
        {requirementLines.length > 0 && (
          <div className="mb-10 rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Requirements
            </h2>
            <ul className="space-y-2.5">
              {requirementLines.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: primaryColor }} />
                  {line.replace(/^[-•]\s*/, "").trim()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Apply button */}
        <div className="flex justify-center">
          <Link
            href={`/${slug}/apply/${jobId}`}
            className="rounded-full px-10 py-3.5 text-base font-semibold text-white transition hover:opacity-85"
            style={{ backgroundColor: primaryColor }}
          >
            Apply for this position
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-card py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {org.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
