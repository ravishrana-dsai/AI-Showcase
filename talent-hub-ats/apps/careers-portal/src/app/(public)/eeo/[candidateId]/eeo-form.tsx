"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary / Third gender",
  "Self-describe",
  "Prefer not to say",
];

const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or more races",
  "Prefer not to say",
];

const VETERAN_OPTIONS = [
  "Not a veteran",
  "Vietnam Era Veteran",
  "Disabled Veteran",
  "Recently Separated Veteran",
  "Active Duty Wartime or Campaign Badge Veteran",
  "Prefer not to say",
];

const DISABILITY_OPTIONS = [
  "Yes, I have a disability",
  "No, I don't have a disability",
  "I don't wish to answer",
];

export function EeoForm({ candidateId }: { candidateId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    gender: "",
    race: "",
    ethnicity: "",
    veteranStatus: "",
    disabilityStatus: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/public/eeo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, ...form }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <div>
          <p className="font-medium">Thank you!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your voluntary response has been recorded.
          </p>
        </div>
      </div>
    );
  }

  const selectClass =
    "w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Gender identity</label>
        <select
          value={form.gender}
          onChange={(e) => update("gender", e.target.value)}
          className={`mt-1 ${selectClass}`}
        >
          <option value="">Prefer not to say</option>
          {GENDER_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Race</label>
        <select
          value={form.race}
          onChange={(e) => update("race", e.target.value)}
          className={`mt-1 ${selectClass}`}
        >
          <option value="">Prefer not to say</option>
          {RACE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Ethnicity</label>
        <select
          value={form.ethnicity}
          onChange={(e) => update("ethnicity", e.target.value)}
          className={`mt-1 ${selectClass}`}
        >
          <option value="">Prefer not to say</option>
          <option value="Hispanic or Latino">Hispanic or Latino</option>
          <option value="Not Hispanic or Latino">Not Hispanic or Latino</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Veteran status</label>
        <select
          value={form.veteranStatus}
          onChange={(e) => update("veteranStatus", e.target.value)}
          className={`mt-1 ${selectClass}`}
        >
          <option value="">Prefer not to say</option>
          {VETERAN_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Disability status</label>
        <select
          value={form.disabilityStatus}
          onChange={(e) => update("disabilityStatus", e.target.value)}
          className={`mt-1 ${selectClass}`}
        >
          <option value="">Prefer not to say</option>
          {DISABILITY_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit voluntarily"}
      </button>
      <p className="text-xs text-center text-muted-foreground">
        All fields are optional. This information is never used in hiring decisions.
      </p>
    </form>
  );
}
