export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Linkedin,
  Globe,
  Calendar,
  MessageSquare,
  Clock,
  FileText,
  ExternalLink,
  User,
  Download,
  Pencil,
} from "lucide-react";
import { formatDate, formatDateTime, formatRelativeTime, formatSalary } from "@/lib/utils";
import { CandidateDocuments } from "@/components/candidates/candidate-documents";
import { CandidateNotes } from "@/components/candidates/candidate-notes";
import { AddToJobDialog } from "@/components/candidates/add-to-job-dialog";
import { PrivacyLock } from "@/components/ui/privacy-lock";
import { canView, mergeVisibilityConfig } from "@/lib/visibility";
import { DeleteCandidateButton } from "@/components/candidates/delete-candidate-button";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const [candidate, org] = await Promise.all([
    prisma.candidate.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        applications: {
          include: {
            job: { select: { id: true, title: true, status: true } },
            currentStage: { select: { name: true, type: true } },
            interviews: {
              include: {
                panelists: {
                  include: { user: { select: { name: true } } },
                },
              },
              orderBy: { scheduledAt: "desc" },
              take: 5,
            },
            scorecards: {
              include: {
                reviewer: { select: { name: true } },
              },
              orderBy: { submittedAt: "desc" },
              take: 5,
            },
            offer: true,
            stageHistory: {
              include: { stage: { select: { name: true } } },
              orderBy: { enteredAt: "desc" },
            },
          },
          orderBy: { appliedAt: "desc" },
        },
        tags: {
          include: { tag: true },
        },
        notes: {
          include: {
            author: { select: { name: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        eeoResponse: true,
      },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { visibilityConfig: true },
    }),
  ]);

  if (!candidate) {
    notFound();
  }

  const storedConfig =
    org?.visibilityConfig !== null && typeof org?.visibilityConfig === "object"
      ? (org.visibilityConfig as Record<string, Record<string, boolean>>)
      : {};

  const visConfig = mergeVisibilityConfig(storedConfig);
  const role = user.role;

  const showContactInfo = canView("contactInfo", role, visConfig);
  const showExpectedCtc = canView("expectedCtc", role, visConfig);
  const showNoticePeriod = canView("noticePeriod", role, visConfig);
  const showLinkedinUrl = canView("linkedinUrl", role, visConfig);
  const showSource = canView("source", role, visConfig);
  const showSkills = canView("skills", role, visConfig);
  const showSummary = canView("summary", role, visConfig);
  const showResume = canView("resume", role, visConfig);

  const activeApplication = candidate.applications.find(
    (a) => a.status === "ACTIVE"
  );

  // Parse skills out of customFields JSON (stored by resume parser)
  let parsedSkills: string[] = [];
  if (candidate.customFields) {
    try {
      const cf = JSON.parse(candidate.customFields as string);
      if (Array.isArray(cf?.skills)) parsedSkills = cf.skills;
    } catch {
      // malformed JSON, ignore
    }
  }

  const scorecardRatingColors: Record<string, string> = {
    STRONG_YES: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    YES: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    NEUTRAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    NO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    STRONG_NO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const offerStatusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PENDING_APPROVAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    SENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    DECLINED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    VOIDED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    EXPIRED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
            {candidate.firstName[0]}
            {candidate.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {candidate.firstName} {candidate.lastName}
            </h1>
            {candidate.currentTitle && (
              <p className="text-muted-foreground mt-0.5">
                {candidate.currentTitle}
                {candidate.currentCompany &&
                  ` at ${candidate.currentCompany}`}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {candidate.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color || undefined,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            href={`/dashboard/candidates/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit details
          </Link>
          {["SUPER_ADMIN", "ADMIN"].includes(role) && (
            <DeleteCandidateButton
              candidateId={id}
              candidateName={`${candidate.firstName} ${candidate.lastName}`}
            />
          )}
          {activeApplication && (
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground">
                {activeApplication.currentStage.name}
              </span>
              <p className="text-sm text-muted-foreground mt-1">
                {activeApplication.job.title}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact Info and Details */}
        <div className="space-y-6">
          {/* Contact Information */}
          <PrivacyLock visible={showContactInfo} label="Contact info hidden by admin settings">
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Contact Information
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${candidate.email}`}
                    className="text-info hover:underline truncate"
                  >
                    {candidate.email}
                  </a>
                </div>
                {candidate.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{candidate.phone}</span>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{candidate.location}</span>
                  </div>
                )}
                {showLinkedinUrl && candidate.linkedinUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a
                      href={candidate.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline flex items-center gap-1"
                    >
                      LinkedIn Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {candidate.portfolioUrl && (
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a
                      href={candidate.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline flex items-center gap-1"
                    >
                      Portfolio
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </PrivacyLock>

          {/* LinkedIn standalone card when contact info is hidden but linkedin is visible */}
          {!showContactInfo && showLinkedinUrl && candidate.linkedinUrl && (
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                LinkedIn
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
                <a
                  href={candidate.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline flex items-center gap-1"
                >
                  LinkedIn Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Source */}
          <PrivacyLock visible={showSource} label="Source info hidden by admin settings">
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Source
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">
                    {candidate.source || "Unknown"}
                  </span>
                </div>
                {candidate.sourceDetail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Detail</span>
                    <span className="font-medium">{candidate.sourceDetail}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Added</span>
                  <span className="font-medium">
                    {formatDate(candidate.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </PrivacyLock>

          {/* Compensation and availability — visible to Admin/Recruiter/Sub Recruiter only */}
          {(showExpectedCtc || showNoticePeriod) && (
            <div className="bg-card rounded-xl border p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Compensation & Availability
              </h2>
              <div className="space-y-2 text-sm">
                {showExpectedCtc && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected CTC</span>
                    <span className="font-medium">{candidate.expectedCtc || "—"}</span>
                  </div>
                )}
                {showNoticePeriod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notice period</span>
                    <span className="font-medium">{candidate.noticePeriod || "—"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents and Resume Upload */}
          <PrivacyLock visible={showResume} label="Resume hidden by admin settings">
            <CandidateDocuments
              candidateId={candidate.id}
              documents={candidate.documents.map((doc) => ({
                id: doc.id,
                name: doc.name,
                type: doc.type,
                url: doc.url,
                size: doc.size,
                uploadedAt: doc.uploadedAt.toISOString(),
              }))}
            />
          </PrivacyLock>

          {/* Summary */}
          {candidate.summary && (
            <PrivacyLock visible={showSummary} label="Summary hidden by admin settings">
              <div className="bg-card rounded-xl border p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Summary
                </h2>
                <p className="text-sm leading-relaxed">{candidate.summary}</p>
              </div>
            </PrivacyLock>
          )}

          {/* Skills (parsed from resume) */}
          {parsedSkills.length > 0 && (
            <PrivacyLock visible={showSkills} label="Skills hidden by admin settings">
              <div className="bg-card rounded-xl border p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Skills
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {parsedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </PrivacyLock>
          )}
        </div>

        {/* Middle Column - Applications and Pipeline */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Applications</h2>
            <AddToJobDialog
              candidateId={candidate.id}
              existingJobIds={candidate.applications.map((a) => a.job.id)}
            />
          </div>
          {/* Applications */}
          {candidate.applications.map((app) => (
            <div key={app.id} className="bg-card rounded-xl border">
              <div className="p-5 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/dashboard/jobs/${app.job.id}`}
                      className="font-semibold hover:underline"
                    >
                      {app.job.title}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Applied {formatDate(app.appliedAt)}
                      {app.source && ` via ${app.source}`}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      app.status === "ACTIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : app.status === "HIRED"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : app.status === "REJECTED"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
              </div>

              {/* Stage Progress */}
              <div className="p-5 border-b">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Pipeline Progress
                </h3>
                <div className="flex items-center gap-1">
                  {app.stageHistory
                    .slice()
                    .reverse()
                    .map((sh, idx, arr) => (
                      <div key={sh.id} className="flex items-center gap-1">
                        <div
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            sh.stage.name === app.currentStage.name
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {sh.stage.name}
                        </div>
                        {idx < arr.length - 1 && (
                          <div className="w-4 h-px bg-border" />
                        )}
                      </div>
                    ))}
                  {app.stageHistory.length === 0 && (
                    <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                      {app.currentStage.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Interviews for this application */}
              {app.interviews.length > 0 && (
                <div className="p-5 border-b">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Interviews
                  </h3>
                  <div className="space-y-3">
                    {app.interviews.map((interview) => (
                      <div
                        key={interview.id}
                        className="flex items-start gap-3"
                      >
                        <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">
                            {interview.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(interview.scheduledAt)} &bull;{" "}
                            {interview.durationMinutes} min &bull;{" "}
                            {interview.type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Panel:{" "}
                            {interview.panelists
                              .map((p) => p.user.name)
                              .join(", ")}
                          </p>
                          <span
                            className={`inline-flex items-center mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              interview.status === "COMPLETED"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : interview.status === "CANCELLED"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {interview.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scorecards for this application */}
              {app.scorecards.length > 0 && (
                <div className="p-5 border-b">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Scorecards
                  </h3>
                  <div className="space-y-3">
                    {app.scorecards.map((sc) => (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {sc.reviewer.name}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            scorecardRatingColors[sc.overallRating] ||
                            "bg-gray-100"
                          }`}
                        >
                          {sc.overallRating.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Offer for this application */}
              {app.offer && (
                <div className="p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Offer
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{app.offer.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSalary(app.offer.salary, app.offer.salaryCurrency)} / {app.offer.salaryPeriod.toLowerCase()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        offerStatusColors[app.offer.status] || "bg-gray-100"
                      }`}
                    >
                      {app.offer.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {candidate.applications.length === 0 && (
            <div className="bg-card rounded-xl border p-8 text-center">
              <Briefcase className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No applications yet.
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Notes and Activity */}
        <div className="space-y-6">
          {/* Notes */}
          <CandidateNotes
            candidateId={candidate.id}
            initialNotes={candidate.notes.map((n) => ({
              id: n.id,
              content: n.content,
              isPrivate: n.isPrivate,
              createdAt: n.createdAt.toISOString(),
              author: { name: n.author.name, avatar: n.author.avatar },
            }))}
          />

          {/* Activity Timeline */}
          <div className="bg-card rounded-xl border">
            <div className="p-5 border-b">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </h2>
            </div>
            {candidate.activities.length === 0 ? (
              <div className="p-5">
                <p className="text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-4">
                  {candidate.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
