"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface EeoFormProps {
  candidateId: string;
  existingData?: {
    gender?: string | null;
    race?: string | null;
    ethnicity?: string | null;
    veteranStatus?: string | null;
    disabilityStatus?: string | null;
  };
  onSubmit?: () => void;
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "DECLINE_TO_ANSWER", label: "I prefer not to answer" },
];

const RACE_OPTIONS = [
  { value: "AMERICAN_INDIAN_ALASKA_NATIVE", label: "American Indian or Alaska Native" },
  { value: "ASIAN", label: "Asian" },
  { value: "BLACK_AFRICAN_AMERICAN", label: "Black or African American" },
  { value: "NATIVE_HAWAIIAN_PACIFIC_ISLANDER", label: "Native Hawaiian or Other Pacific Islander" },
  { value: "WHITE", label: "White" },
  { value: "TWO_OR_MORE", label: "Two or More Races" },
  { value: "DECLINE_TO_ANSWER", label: "I prefer not to answer" },
];

const ETHNICITY_OPTIONS = [
  { value: "HISPANIC_LATINO", label: "Hispanic or Latino" },
  { value: "NOT_HISPANIC_LATINO", label: "Not Hispanic or Latino" },
  { value: "DECLINE_TO_ANSWER", label: "I prefer not to answer" },
];

const VETERAN_OPTIONS = [
  { value: "PROTECTED_VETERAN", label: "I identify as one or more of the classifications of a protected veteran" },
  { value: "NOT_PROTECTED_VETERAN", label: "I am NOT a protected veteran" },
  { value: "DECLINE_TO_ANSWER", label: "I prefer not to answer" },
];

const DISABILITY_OPTIONS = [
  { value: "YES", label: "Yes, I have a disability (or previously had a disability)" },
  { value: "NO", label: "No, I don't have a disability" },
  { value: "DECLINE_TO_ANSWER", label: "I prefer not to answer" },
];

export function EeoForm({ candidateId, existingData, onSubmit }: EeoFormProps) {
  const [gender, setGender] = useState(existingData?.gender || "");
  const [race, setRace] = useState(existingData?.race || "");
  const [ethnicity, setEthnicity] = useState(existingData?.ethnicity || "");
  const [veteranStatus, setVeteranStatus] = useState(existingData?.veteranStatus || "");
  const [disabilityStatus, setDisabilityStatus] = useState(existingData?.disabilityStatus || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(getApiUrl("/api/eeo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          gender: gender || null,
          race: race || null,
          ethnicity: ethnicity || null,
          veteranStatus: veteranStatus || null,
          disabilityStatus: disabilityStatus || null,
        }),
      });

      if (res.ok) {
        setIsSubmitted(true);
        onSubmit?.();
      }
    } catch (err) {
      console.error("EEO submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-8 text-center">
        <CheckCircle className="w-12 h-12 mx-auto text-success mb-3" />
        <h3 className="text-lg font-semibold">Thank you</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your self-identification information has been recorded.
        </p>
      </div>
    );
  }

  const selectClass =
    "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 rounded-lg bg-muted/50 border text-sm">
        <p className="font-medium mb-1">Voluntary Self-Identification</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          We are an equal opportunity employer. In accordance with federal law,
          we invite you to voluntarily self-identify your gender, race/ethnicity,
          veteran status, and disability status. This information is collected
          solely for compliance with federal record-keeping requirements and
          will not be used in any hiring decisions. Submission is voluntary and
          refusal will not subject you to any adverse treatment.
        </p>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Gender</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Race */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Race</label>
        <select
          value={race}
          onChange={(e) => setRace(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {RACE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Ethnicity */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Ethnicity</label>
        <select
          value={ethnicity}
          onChange={(e) => setEthnicity(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {ETHNICITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Veteran Status */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Protected Veteran Status
        </label>
        <select
          value={veteranStatus}
          onChange={(e) => setVeteranStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {VETERAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Disability Status */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Disability Status
        </label>
        <select
          value={disabilityStatus}
          onChange={(e) => setDisabilityStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">Select...</option>
          {DISABILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </span>
        ) : (
          "Submit Self-Identification"
        )}
      </button>
    </form>
  );
}
