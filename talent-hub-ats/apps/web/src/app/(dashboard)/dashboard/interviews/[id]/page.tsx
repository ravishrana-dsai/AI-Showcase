export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import {
  Calendar,
  User,
  Briefcase,
  Video,
  MapPin,
  FileText,
  ExternalLink,
  ArrowLeft,
  Paperclip,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { InterviewFeedbackBlock } from "@/components/interviews/interview-feedback-block";
import { InterviewSendInvite } from "@/components/interviews/interview-send-invite";

const RATING_LABEL: Record<string, string> = {
  "1": "Strong No",
  "2": "No Hire",
  "3": "Hire",
  "4": "Strong Yes",
  "NA": "N/A",
};

const RATING_COLOR: Record<string, string> = {
  "1": "text-red-600 bg-red-50 dark:bg-red-900/20",
  "2": "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  "3": "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  "4": "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30",
  "NA": "text-muted-foreground bg-muted",
};

type CriterionRating = { criterion: string; rating: number | "NA" };
type ParsedRatings = {
  sections?: string[];
  technical?: CriterionRating[];
  cultural?: CriterionRating[];
  averageScore?: number | null;
} | null;

function parseRatings(raw: string): ParsedRatings {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
      return parsed as ParsedRatings;
    }
  } catch {
    // ignore
  }
  return null;
}

function CriterionRow({ criterion, rating }: { criterion: string; rating: number | "NA" }) {
  const key = String(rating);
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-xs text-muted-foreground">{criterion}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RATING_COLOR[key] ?? "text-muted-foreground bg-muted"}`}>
        {RATING_LABEL[key] ?? key}
      </span>
    </div>
  );
}

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      application: {
        include: {
          candidate: true,
          job: true,
          currentStage: true,
        },
      },
      panelists: { include: { user: true } },
      scorecards: {
        select: {
          id: true,
          reviewerId: true,
          recommendation: true,
          summary: true,
          ratings: true,
          attachmentUrl: true,
          attachmentName: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!interview) notFound();

  const isPanelist = interview.panelists.some((p) => p.userId === user.id);
  const hasSubmittedFeedback = interview.scorecards.some(
    (s) => s.reviewerId === user.id
  );

  const candidateName = `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`;
  const jobTitle = interview.application.job.title;

  let scoringCriteria: string[] = [];
  try {
    scoringCriteria = JSON.parse(interview.application.job.scoringCriteria || "[]");
  } catch {
    scoringCriteria = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/my-interviews"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          My Interviews
        </Link>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h1 className="text-2xl font-bold tracking-tight">{interview.title}</h1>
          <p className="text-muted-foreground mt-1">
            {candidateName} | {jobTitle}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {interview.status}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {interview.type}
            </span>
          </div>
        </div>

        <div className="p-6 grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Date & time
                </p>
                <p className="text-sm">
                  {formatDateTime(interview.scheduledAt.toISOString())}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {interview.durationMinutes} min · {interview.timezone}
                </p>
              </div>
            </div>
            {interview.meetingLink ? (
              <div className="flex items-start gap-3">
                <Video className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Meeting link
                  </p>
                  <a
                    href={interview.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Join meeting
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : null}
            {interview.location ? (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm">{interview.location}</p>
                </div>
              </div>
            ) : null}
            {interview.notes ? (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{interview.notes}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Candidate
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/candidates/${interview.application.candidateId}`}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <User className="w-4 h-4" />
                  {candidateName}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <InterviewSendInvite
                  candidateId={interview.application.candidate.id}
                  candidateEmail={interview.application.candidate.email}
                  candidateName={candidateName}
                  meetingLink={interview.meetingLink}
                  interviewTitle={interview.title}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Job
              </p>
              <Link
                href={`/dashboard/jobs/${interview.application.jobId}`}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <Briefcase className="w-4 h-4" />
                {jobTitle}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Panel
              </p>
              <ul className="space-y-1">
                {interview.panelists.map((p) => (
                  <li
                    key={p.id}
                    className="text-sm flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {p.user.name || p.user.email}
                    {p.respondedAt ? (
                      <span className="text-xs text-muted-foreground">
                        (feedback submitted)
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Submitted Feedback */}
        {interview.scorecards.length > 0 && (
          <div className="border-t p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Submitted Feedback ({interview.scorecards.length})
            </h3>
            <div className="space-y-3">
              {interview.scorecards.map((sc) => {
                const reviewer = interview.panelists.find((p) => p.userId === sc.reviewerId);
                const parsed = parseRatings(sc.ratings);
                return (
                  <div key={sc.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span className="text-sm font-medium">
                        {reviewer?.user.name || reviewer?.user.email || "Reviewer"}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {parsed?.averageScore != null && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            Avg {Number(parsed.averageScore).toFixed(1)} / 4
                          </span>
                        )}
                        {sc.recommendation && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            {sc.recommendation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Structured ratings */}
                    {parsed && (parsed.technical?.length || parsed.cultural?.length) ? (
                      <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        {parsed.technical && parsed.technical.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Technical</p>
                            <div className="space-y-0.5">
                              {parsed.technical.map((r) => (
                                <CriterionRow key={r.criterion} criterion={r.criterion} rating={r.rating} />
                              ))}
                            </div>
                          </div>
                        )}
                        {parsed.cultural && parsed.cultural.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cultural</p>
                            <div className="space-y-0.5">
                              {parsed.cultural.map((r) => (
                                <CriterionRow key={r.criterion} criterion={r.criterion} rating={r.rating} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {sc.summary && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">{sc.summary}</p>
                    )}
                    {sc.attachmentUrl && (
                      <a
                        href={`/api/files/${sc.attachmentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {sc.attachmentName || "Attachment"}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isPanelist && (
          <div className="border-t p-6 bg-muted/20">
            <InterviewFeedbackBlock
              interviewId={interview.id}
              candidateName={candidateName}
              jobTitle={jobTitle}
              hasSubmitted={hasSubmittedFeedback}
              scoringCriteria={scoringCriteria}
            />
          </div>
        )}
      </div>
    </div>
  );
}
