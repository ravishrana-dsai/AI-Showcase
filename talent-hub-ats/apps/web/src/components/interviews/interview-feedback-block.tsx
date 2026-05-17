"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Loader2, CheckCircle, Upload, X, Paperclip } from "lucide-react";
import { getApiUrl } from "@/lib/api";

type Option = { value: string; label: string };
type Section = "technical" | "cultural";
type RatingValue = 1 | 2 | 3 | 4 | "NA";

const CULTURAL_VALUES = [
  "Data Oriented",
  "Ownership",
  "Perseverance",
  "User First",
  "Transparency",
];

const RATING_BUTTONS: { value: RatingValue; label: string; short: string }[] = [
  { value: 1, label: "Strong No Hire", short: "1" },
  { value: 2, label: "No Hire", short: "2" },
  { value: 3, label: "Hire", short: "3" },
  { value: 4, label: "Strong Hire", short: "4" },
  { value: "NA", label: "N/A", short: "NA" },
];

const ALLOWED_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function RatingGrid({
  criteria,
  ratings,
  onChange,
}: {
  criteria: string[];
  ratings: Record<string, RatingValue>;
  onChange: (criterion: string, value: RatingValue) => void;
}) {
  return (
    <div className="space-y-2">
      {criteria.map((criterion) => {
        const selected = ratings[criterion];
        return (
          <div key={criterion} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm font-medium w-full sm:w-48 shrink-0">{criterion}</span>
            <div className="flex flex-wrap gap-1.5">
              {RATING_BUTTONS.map((btn) => {
                const isSelected = selected === btn.value;
                return (
                  <button
                    key={String(btn.value)}
                    type="button"
                    onClick={() => onChange(criterion, btn.value)}
                    title={btn.label}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      isSelected
                        ? btn.value === "NA"
                          ? "bg-muted border-muted-foreground/30 text-muted-foreground"
                          : (btn.value as number) <= 2
                          ? "bg-red-500 border-red-500 text-white"
                          : "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {btn.short}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InterviewFeedbackBlock({
  interviewId,
  candidateName,
  jobTitle,
  hasSubmitted,
  scoringCriteria = [],
}: {
  interviewId: string;
  candidateName: string;
  jobTitle: string;
  hasSubmitted: boolean;
  scoringCriteria?: string[];
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState("");
  const [summary, setSummary] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(hasSubmitted);

  const [selectedSections, setSelectedSections] = useState<Set<Section>>(new Set());
  const [technicalRatings, setTechnicalRatings] = useState<Record<string, RatingValue>>({});
  const [culturalRatings, setCulturalRatings] = useState<Record<string, RatingValue>>({});

  useEffect(() => {
    setOptionsLoading(true);
    fetch(getApiUrl("/api/settings/interview-feedback-options"))
      .then((r) => r.json())
      .then((d) => setOptions(d.options ?? []))
      .catch(() =>
        setOptions([
          { value: "PROCEED", label: "Proceed to next stage" },
          { value: "REJECT", label: "Reject" },
        ])
      )
      .finally(() => setOptionsLoading(false));
  }, []);

  // Live average score across all rated (non-NA) values in selected sections
  const allRatedValues = [
    ...(selectedSections.has("technical") ? Object.values(technicalRatings) : []),
    ...(selectedSections.has("cultural") ? Object.values(culturalRatings) : []),
  ].filter((v) => v !== "NA") as number[];
  const avgScore =
    allRatedValues.length > 0
      ? (allRatedValues.reduce((a, b) => a + b, 0) / allRatedValues.length).toFixed(1)
      : null;

  function toggleSection(section: Section) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function handleFileSelect(file: File | null) {
    setAttachmentError(null);
    if (!file) {
      setAttachmentFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setAttachmentError("Only PNG, JPEG, and PDF files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAttachmentError("File must be under 5 MB.");
      return;
    }
    setAttachmentFile(file);
  }

  function removeFile() {
    setAttachmentFile(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendation.trim()) {
      setError("Please select a recommendation.");
      return;
    }
    if (selectedSections.size === 0) {
      setError("Please select at least one section to rate (Technical or Cultural).");
      return;
    }
    if (selectedSections.has("technical") && scoringCriteria.length > 0) {
      const unrated = scoringCriteria.filter((c) => technicalRatings[c] === undefined);
      if (unrated.length > 0) {
        setError(`Please rate all technical criteria. Missing: ${unrated.join(", ")}`);
        return;
      }
    }
    if (selectedSections.has("cultural")) {
      const unrated = CULTURAL_VALUES.filter((c) => culturalRatings[c] === undefined);
      if (unrated.length > 0) {
        setError(`Please rate all cultural values. Missing: ${unrated.join(", ")}`);
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    const sections = Array.from(selectedSections);
    const technicalPayload = selectedSections.has("technical")
      ? Object.entries(technicalRatings).map(([criterion, rating]) => ({ criterion, rating }))
      : [];
    const culturalPayload = selectedSections.has("cultural")
      ? Object.entries(culturalRatings).map(([criterion, rating]) => ({ criterion, rating }))
      : [];

    try {
      let res: Response;

      if (attachmentFile) {
        const formData = new FormData();
        formData.set("recommendation", recommendation.trim());
        if (summary.trim()) formData.set("summary", summary.trim());
        formData.set("sections", JSON.stringify(sections));
        formData.set("technicalRatings", JSON.stringify(technicalPayload));
        formData.set("culturalRatings", JSON.stringify(culturalPayload));
        formData.set("attachment", attachmentFile);
        res = await fetch(getApiUrl(`/api/interviews/${interviewId}/feedback`), {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(getApiUrl(`/api/interviews/${interviewId}/feedback`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendation: recommendation.trim(),
            summary: summary.trim() || undefined,
            sections,
            technicalRatings: technicalPayload,
            culturalRatings: culturalPayload,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit feedback");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">You have submitted feedback for this interview.</span>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">Submit feedback</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {candidateName} | {jobTitle}
      </p>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Section selection */}
        <div>
          <p className="text-sm font-medium mb-2">Sections to rate *</p>
          <div className="flex flex-wrap gap-4">
            {(["technical", "cultural"] as Section[]).map((section) => (
              <label key={section} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedSections.has(section)}
                  onChange={() => toggleSection(section)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-sm font-medium capitalize">{section}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Technical section */}
        {selectedSections.has("technical") && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Technical</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-muted">1 Strong No</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">2 No Hire</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">3 Hire</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">4 Strong Yes</span>
              </div>
            </div>
            {scoringCriteria.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No technical criteria have been defined for this job. Ask the hiring manager to add them in the job settings.
              </p>
            ) : (
              <RatingGrid
                criteria={scoringCriteria}
                ratings={technicalRatings}
                onChange={(c, v) => setTechnicalRatings((prev) => ({ ...prev, [c]: v }))}
              />
            )}
          </div>
        )}

        {/* Cultural section */}
        {selectedSections.has("cultural") && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Cultural</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-muted">1 Strong No</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">2 No Hire</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">3 Hire</span>
                <span className="px-2 py-0.5 rounded-full bg-muted">4 Strong Yes</span>
              </div>
            </div>
            <RatingGrid
              criteria={CULTURAL_VALUES}
              ratings={culturalRatings}
              onChange={(c, v) => setCulturalRatings((prev) => ({ ...prev, [c]: v }))}
            />
          </div>
        )}

        {/* Live average score */}
        {avgScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Average score:</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {avgScore} / 4
            </span>
          </div>
        )}

        {/* Recommendation */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Recommendation *</label>
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

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="Add any comments for the hiring team..."
          />
        </div>

        {/* Attachment upload */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Attachment (optional)
          </label>
          {attachmentFile ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{attachmentFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(attachmentFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted/40 transition"
            >
              <Upload className="w-4 h-4" />
              Upload screenshot or document
            </button>
          )}
          {attachmentError && (
            <p className="mt-1 text-xs text-destructive">{attachmentError}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPEG, or PDF. Max 5 MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            className="sr-only"
            tabIndex={-1}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || optionsLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Submit feedback
        </button>
      </form>
    </div>
  );
}
