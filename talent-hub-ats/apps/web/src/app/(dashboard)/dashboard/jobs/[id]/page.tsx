export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Clock,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@talent-hub/shared";
import { PipelineBoard } from "@/components/jobs/pipeline-board";
import { PipelineStageBar } from "@/components/jobs/pipeline-stage-bar";
import { ScreeningQuestionsEditor } from "@/components/jobs/screening-questions-editor";
import { CandidateQuestionsEditor } from "@/components/jobs/candidate-questions-editor";
import { PublishJobButton } from "@/components/jobs/publish-job-button";
import { JobStatusSelect } from "@/components/jobs/job-status-select";
import { DeleteJobButton } from "@/components/jobs/delete-job-button";
import { JobAssignments } from "@/components/jobs/job-assignments";
import { FeedbackPreviewEditor } from "@/components/jobs/feedback-preview-editor";
import { sanitizeHtml } from "@/lib/sanitize";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const job = await prisma.job.findFirst({
    where: {
      id,
      organizationId: user.organizationId,
    },
    include: {
      department: { select: { name: true } },
      location: { select: { id: true, name: true } },
      hiringManager: { select: { name: true, email: true } },
      createdBy: { select: { name: true } },
      pipelineStages: {
        orderBy: { order: "asc" },
      },
      applications: {
        where: { status: "ACTIVE" },
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              currentTitle: true,
              currentCompany: true,
            },
          },
          recruiter: { select: { id: true, name: true, email: true } },
        },
        orderBy: { appliedAt: "desc" },
      },
      _count: {
        select: { applications: true },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const users = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const boardApplications = job.applications.map((app) => ({
    ...app,
    appliedAt: app.appliedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <Link
              href={`/dashboard/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
            <PublishJobButton jobId={job.id} status={job.status} />
            <JobStatusSelect jobId={job.id} status={job.status} />
            <DeleteJobButton jobId={job.id} userRole={user.role} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {job.department && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {job.department.name}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {job.location.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {EMPLOYMENT_TYPE_LABELS[job.employmentType] || job.employmentType}
            </span>
            {job.experienceLevel && (
              <span>
                {EXPERIENCE_LEVEL_LABELS[job.experienceLevel] ||
                  job.experienceLevel}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Created {formatDate(job.createdAt)}</p>
          {job.hiringManager && <p>HM: {job.hiringManager.name}</p>}
          <p>By: {job.createdBy.name}</p>
        </div>
      </div>

      {/* Pipeline - Drag & Drop Kanban Board */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline ({job._count.applications} total candidates)
          </h2>
          <Link
            href={`/dashboard/jobs/${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open full view
          </Link>
        </div>
        <PipelineStageBar stages={job.pipelineStages} applications={boardApplications} />
        <PipelineBoard
          jobId={job.id}
          stages={job.pipelineStages}
          applications={boardApplications}
          users={users}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Description */}
        <div className="space-y-6">
          {job.openingParagraph && (
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Opening Paragraph
              </h2>
              <p className="text-sm leading-relaxed text-foreground">{job.openingParagraph}</p>
            </div>
          )}
          <div className="bg-card rounded-xl border p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Description
            </h2>
            {/<[a-z][\s\S]*>/i.test(job.description ?? "") ? (
              <div
                className="text-sm text-foreground [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:leading-relaxed [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description ?? "") }}
              />
            ) : (
              <ul className="space-y-2">
                {(job.description ?? "").split("\n").filter((line) => line.trim()).map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {line.replace(/^[-•]\s*/, "").trim()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-6">
          {job.requirements && (
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Requirements
              </h2>
              <ul className="space-y-2">
                {job.requirements.split("\n").filter((line) => line.trim()).map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    {line.replace(/^[-•]\s*/, "").trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Sub-recruiter Assignments */}
      <JobAssignments jobId={job.id} userRole={user.role} />

      {/* Application Questions (shown to candidates) */}
      <CandidateQuestionsEditor jobId={job.id} />

      {/* Screening Questions (internal recruiter use) */}
      <ScreeningQuestionsEditor jobId={job.id} />

      {/* Feedback form preview — editable by admin/recruiter roles */}
      {["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"].includes(user.role) && (
        <FeedbackPreviewEditor
          jobId={job.id}
          initialCriteria={JSON.parse(job.scoringCriteria ?? "[]")}
        />
      )}
    </div>
  );
}
