export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApplyForm, type CandidateQuestion } from "@/app/(public)/jobs/apply/[jobId]/apply-form";
import type { Metadata } from "next";
import {
  fetchOrgJobDetail,
  fetchJobMeta,
  hiringPortalLogoSrc,
  parseQuestionOptionsJson,
} from "@/lib/hiring-portal";

interface PageProps {
  params: Promise<{ slug: string; jobId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, jobId } = await params;
  const data = await fetchOrgJobDetail(slug, jobId);
  if (data?.job) {
    return {
      title: `Apply: ${data.job.title} | ${data.job.organization?.name ?? "Careers"}`,
    };
  }
  const meta = await fetchJobMeta(jobId);
  return {
    title: meta ? `Apply: ${meta.title} | ${meta.orgName ?? "Careers"}` : "Apply | Careers",
  };
}

export default async function OrgApplyPage({ params }: PageProps) {
  const { slug, jobId } = await params;

  const data = await fetchOrgJobDetail(slug, jobId);
  if (!data) return notFound();

  const { organization: org, job, screeningQuestions: questionRows } = data;
  if (!job || job.organization?.id !== org.id) return notFound();

  const customQuestions: CandidateQuestion[] = questionRows.map((q) => ({
    id: q.id,
    question: q.question,
    type: q.type,
    options: parseQuestionOptionsJson(q.options),
    isRequired: q.isRequired,
  }));

  const primaryColor = org.careerPageConfig?.primaryColor ?? "#7c3aed";
  const logoSrc = hiringPortalLogoSrc(org.careerPageConfig?.logoUrl ?? null, null);

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <nav className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${slug}`} className="flex items-center gap-2.5">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={org.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-base font-black text-foreground">{org.name}</span>
            )}
          </Link>
          <Link
            href={`/${slug}/jobs/${jobId}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to job
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Your application</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Applying for <span className="font-medium text-foreground">{job.title}</span> at {org.name}.
            Fields marked with <span className="text-destructive">*</span> are required.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <ApplyForm jobId={job.id} jobTitle={job.title} customQuestions={customQuestions} />
        </div>

        <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: primaryColor + "15" }}>
          <p className="text-xs leading-relaxed text-center" style={{ color: primaryColor }}>
            We review every application carefully. You will hear back from us within 5-7 business days.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-card py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {org.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
