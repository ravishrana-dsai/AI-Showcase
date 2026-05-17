"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  User,
  FileText,
  Loader2,
  CheckCircle,
  X,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

type Option = { value: string; label: string };

type InterviewItem = {
  id: string;
  title: string;
  status: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink?: string | null;
  application: {
    id: string;
    candidate: { id: string; firstName: string; lastName: string; email: string };
    job: { id: string; title: string };
    currentStage: { name: string };
  };
  panelists: { user: { id: string; name: string | null; email: string } }[];
  myScorecard: {
    id: string;
    overallRating: string;
    recommendation: string | null;
    submittedAt: string;
  } | null;
};

export function MyInterviewsClient() {
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [feedbackInterview, setFeedbackInterview] = useState<InterviewItem | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/interviews/mine"))
      .then((r) => r.json())
      .then((d) => setInterviews(d.interviews ?? []))
      .catch(() => setInterviews([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (feedbackInterview) {
      setOptionsLoading(true);
      setFeedbackError(null);
      setRecommendation("");
      setSummary("");
      fetch(getApiUrl("/api/settings/interview-feedback-options"))
        .then((r) => r.json())
        .then((d) => setOptions(d.options ?? []))
        .catch(() => setOptions([{ value: "PROCEED", label: "Proceed to next stage" }, { value: "REJECT", label: "Reject" }]))
        .finally(() => setOptionsLoading(false));
    }
  }, [feedbackInterview]);

  const now = new Date().toISOString();
  const upcoming = interviews.filter(
    (i) =>
      ["SCHEDULED", "CONFIRMED"].includes(i.status) &&
      i.scheduledAt >= now
  );
  const past = interviews.filter(
    (i) =>
      !["SCHEDULED", "CONFIRMED"].includes(i.status) || i.scheduledAt < now
  );
  upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const list = tab === "upcoming" ? upcoming : past;

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackInterview) return;
    if (!recommendation.trim()) {
      setFeedbackError("Please select a recommendation.");
      return;
    }
    setFeedbackError(null);
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl(`/api/interviews/${feedbackInterview.id}/feedback`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: recommendation.trim(),
          summary: summary.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit feedback");
      setFeedbackInterview(null);
      setInterviews((prev) =>
        prev.map((i) =>
          i.id === feedbackInterview.id
            ? {
                ...i,
                myScorecard: {
                  id: data.id,
                  overallRating: data.overallRating,
                  recommendation: data.recommendation,
                  submittedAt: data.submittedAt ?? new Date().toISOString(),
                },
              }
            : i
        )
      );
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "upcoming"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Upcoming
          <span
            className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px] ${
              tab === "upcoming"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {upcoming.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("past")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "past"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          Past
          <span
            className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[20px] ${
              tab === "past"
                ? "bg-white/20 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {past.length}
          </span>
        </button>
      </div>

      <div className="bg-card rounded-xl border">
        {list.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">
              {tab === "upcoming"
                ? "No upcoming interviews"
                : "No past interviews"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {tab === "upcoming"
                ? "Interviews you’re assigned to will appear here."
                : "Completed or cancelled interviews appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {list.map((interview) => (
              <div
                key={interview.id}
                className="p-5 hover:bg-muted/50 transition-colors flex flex-wrap items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{interview.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {interview.application.candidate.firstName}{" "}
                      {interview.application.candidate.lastName} &middot;{" "}
                      {interview.application.job.title}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateTime(interview.scheduledAt)} ·{" "}
                        {interview.durationMinutes} min
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted">
                        {interview.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {interview.myScorecard ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Feedback submitted
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFeedbackInterview(interview)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Give feedback
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback panel modal */}
      {feedbackInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !submitting && setFeedbackInterview(null)}
          />
          <div
            className="relative z-10 w-full max-w-md bg-card rounded-xl border shadow-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Submit feedback</h3>
              <button
                type="button"
                onClick={() => !submitting && setFeedbackInterview(null)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {feedbackInterview.application.candidate.firstName}{" "}
              {feedbackInterview.application.candidate.lastName} &middot;{" "}
              {feedbackInterview.application.job.title}
            </p>
            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              {feedbackError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {feedbackError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Recommendation *
                </label>
                {optionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading options...</p>
                ) : (
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  >
                    <option value="">Select...</option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  placeholder="Add any comments for the hiring team..."
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => !submitting && setFeedbackInterview(null)}
                  className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || optionsLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Submit feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
