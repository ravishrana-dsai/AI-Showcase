export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Gamepad2 } from "lucide-react";
import { prisma } from "@talent-hub/db";
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "@talent-hub/shared";
import { ApplyForm, type CandidateQuestion } from "./apply-form";
import { sanitizeHtml } from "@/lib/sanitize";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

interface ApplyPageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: ApplyPageProps) {
  const { jobId } = await params;
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...publicCareersJobWhere },
    select: { title: true },
  });
  return {
    title: job ? `Apply: ${job.title} | [Company] Careers` : "Apply | [Company] Careers",
  };
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { jobId } = await params;

  const [job, questionRows] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, ...publicCareersJobWhere },
      select: {
        id: true,
        title: true,
        employmentType: true,
        experienceLevel: true,
        openingParagraph: true,
        description: true,
        requirements: true,
        location: { select: { name: true } },
        department: { select: { name: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.screeningQuestion.findMany({
      where: { jobId, showToCandidate: true },
      orderBy: { order: "asc" },
    }),
  ]);

  if (!job) notFound();

  const customQuestions: CandidateQuestion[] = questionRows.map((q) => ({
    id: q.id,
    question: q.question,
    type: q.type,
    options: q.options ? (JSON.parse(q.options) as string[]) : null,
    isRequired: q.isRequired,
  }));

  const employmentLabel =
    job.employmentType
      ? (EMPLOYMENT_TYPE_LABELS[job.employmentType as keyof typeof EMPLOYMENT_TYPE_LABELS] ?? job.employmentType)
      : null;

  const experienceLabel =
    job.experienceLevel
      ? (EXPERIENCE_LEVEL_LABELS[job.experienceLevel as keyof typeof EXPERIENCE_LEVEL_LABELS] ?? job.experienceLevel)
      : null;

  const requirementLines = job.requirements
    ? job.requirements.split("\n").filter((line) => line.trim())
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <nav className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/jobs" className="flex items-center gap-2.5">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
              alt="[Company]"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <Link
            href="/jobs"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            All positions
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Job header */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Gamepad2 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              {job.department?.name && (
                <span className="mb-2 inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {job.department.name}
                </span>
              )}
              <h1 className="text-2xl font-bold text-foreground leading-snug">{job.title}</h1>
              {job.organization?.name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{job.organization.name}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                {employmentLabel && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0 text-violet-500" />
                    {employmentLabel}
                  </span>
                )}
                {experienceLabel && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="h-4 w-4 shrink-0 text-center text-xs font-bold text-violet-500">XP</span>
                    {experienceLabel}
                  </span>
                )}
                {job.location?.name && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                    {job.location.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* LEFT: Job details */}
          <div className="lg:col-span-3 space-y-6">
            {/* Opening paragraph */}
            {job.openingParagraph && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm leading-relaxed text-foreground">{job.openingParagraph}</p>
              </div>
            )}

            {/* Description */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                About the role
              </h2>
              <div
                className="text-sm text-foreground [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:leading-relaxed [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
              />
            </div>

            {/* Requirements */}
            {requirementLines.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Requirements
                </h2>
                <ul className="space-y-2.5">
                  {requirementLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                      {line.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* RIGHT: Apply form */}
          <aside className="lg:col-span-2">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-1.5 text-xl font-bold text-foreground">Your application</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Fields marked with <span className="text-destructive">*</span> are required.
              </p>
              <ApplyForm jobId={job.id} jobTitle={job.title} customQuestions={customQuestions} />
              <div className="mt-5 rounded-xl bg-violet-50 p-4 dark:bg-violet-900/20">
                <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                  We review every application carefully. You will hear back from
                  us within 5-7 business days.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-border bg-card py-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
              alt="[Company]"
              width={96}
              height={24}
              className="h-6 w-auto object-contain opacity-70"
            />
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} [Company]. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
