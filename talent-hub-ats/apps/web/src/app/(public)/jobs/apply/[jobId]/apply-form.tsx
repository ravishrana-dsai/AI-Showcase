"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Upload,
  User,
  Mail,
  Phone,
  Linkedin,
  Link as LinkIcon,
  FileText,
  X,
  Check,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";

export interface CandidateQuestion {
  id: string;
  question: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
}

interface ApplyFormProps {
  jobId: string;
  jobTitle: string;
  customQuestions?: CandidateQuestion[];
}

interface FormSection {
  title: string;
  description: string;
}

function SectionHeading({ title, description }: FormSection) {
  return (
    <div className="mb-4 pb-3 border-b border-border">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

interface FieldProps {
  label: string;
  required?: boolean;
  id: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, required, id, error, children, hint }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StepIndicator({ currentStep, labels }: { currentStep: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {labels.map((label, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "border-violet-600 bg-violet-600 text-white"
                    : isCurrent
                      ? "border-violet-600 bg-transparent text-violet-600"
                      : "border-gray-300 bg-transparent text-gray-400"
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : i + 1}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  isCompleted || isCurrent ? "text-violet-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-16 sm:w-24 transition-colors ${
                  i < currentStep ? "bg-violet-600" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border border-border bg-background py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition";
const INPUT_PLAIN = `${INPUT_BASE} px-3`;
const INPUT_ICON = `${INPUT_BASE} pl-10 pr-3`;

export function ApplyForm({ jobId, jobTitle, customQuestions = [] }: ApplyFormProps) {
  const hasCustomQuestions = customQuestions.length > 0;

  // Build steps dynamically
  const SECTIONS: FormSection[] = [
    { title: "Personal details", description: "Tell us who you are." },
    { title: "Your profile", description: "Links and a short pitch." },
    ...(hasCustomQuestions ? [{ title: "Questions", description: "A few questions from the team." }] : []),
    { title: "Your resume", description: "Upload your CV to complete your application." },
  ];
  const STEP_LABELS = [
    "Personal Details",
    "Profile",
    ...(hasCustomQuestions ? ["Questions"] : []),
    "Resume",
  ];

  // Step indices
  const STEP_QUESTIONS = hasCustomQuestions ? 2 : -1;
  const STEP_RESUME = hasCustomQuestions ? 3 : 2;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);

  function validateStep(step: number): boolean {
    const errors: Record<string, string> = {};

    if (step === 0) {
      if (!firstName.trim()) errors.firstName = "First name is required.";
      if (!lastName.trim()) errors.lastName = "Last name is required.";
      if (!email.trim()) {
        errors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.email = "Please enter a valid email address.";
      }
      if (!phone.trim()) errors.phone = "Phone number is required.";
    }

    if (step === 1) {
      if (linkedinUrl.trim() && !/^https?:\/\/(www\.)?linkedin\.com\//.test(linkedinUrl.trim())) {
        errors.linkedinUrl = "Must be a valid LinkedIn URL.";
      }
    }

    if (step === STEP_QUESTIONS) {
      for (const q of customQuestions) {
        if (q.isRequired && !answers[q.id]?.trim()) {
          errors[q.id] = "This question is required.";
        }
      }
    }

    if (step === STEP_RESUME) {
      if (!cvFile) errors.cv = "Please upload your CV to continue.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (validateStep(currentStep)) setCurrentStep((prev) => prev + 1);
  }

  function handleBack() {
    setFieldErrors({});
    setCurrentStep((prev) => prev - 1);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep(STEP_RESUME)) return;
    setLoading(true);

    const screeningAnswers = hasCustomQuestions
      ? JSON.stringify(
          customQuestions.map((q) => ({ questionId: q.id, question: q.question, answer: answers[q.id] ?? "" }))
        )
      : undefined;

    try {
      if (cvFile) {
        const form = new FormData();
        form.set("jobId", jobId);
        form.set("firstName", firstName.trim());
        form.set("lastName", lastName.trim());
        form.set("email", email.trim());
        form.set("phone", phone.trim());
        if (summary.trim()) form.set("summary", summary.trim());
        if (linkedinUrl.trim()) form.set("linkedinUrl", linkedinUrl.trim());
        if (portfolioUrl.trim()) form.set("portfolioUrl", portfolioUrl.trim());
        if (screeningAnswers) form.set("screeningAnswers", screeningAnswers);
        form.set("cv", cvFile);
        const res = await fetch(getApiUrl("/api/public/jobs/apply"), { method: "POST", body: form });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      } else {
        const res = await fetch(getApiUrl("/api/public/jobs/apply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            summary: summary.trim() || undefined,
            linkedinUrl: linkedinUrl.trim() || undefined,
            portfolioUrl: portfolioUrl.trim() || undefined,
            screeningAnswers,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Application sent!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for applying to{" "}
          <span className="font-medium text-foreground">{jobTitle}</span>. We will review your application and be in touch within 5-7 business days.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition"
        >
          <ArrowLeft className="h-4 w-4" />
          View other positions
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <StepIndicator currentStep={currentStep} labels={STEP_LABELS} />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 0: Personal Details */}
      {currentStep === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeading title={SECTIONS[0].title} description={SECTIONS[0].description} />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required id="apply-first" error={fieldErrors.firstName}>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input id="apply-first" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className={`${INPUT_ICON} ${fieldErrors.firstName ? "border-destructive focus:ring-destructive" : ""}`} />
                </div>
              </Field>
              <Field label="Last name" required id="apply-last" error={fieldErrors.lastName}>
                <input id="apply-last" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" className={`${INPUT_PLAIN} ${fieldErrors.lastName ? "border-destructive focus:ring-destructive" : ""}`} />
              </Field>
            </div>
            <Field label="Email" required id="apply-email" error={fieldErrors.email}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input id="apply-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className={`${INPUT_ICON} ${fieldErrors.email ? "border-destructive focus:ring-destructive" : ""}`} />
              </div>
            </Field>
            <Field label="Phone" required id="apply-phone" error={fieldErrors.phone}>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input id="apply-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={`${INPUT_ICON} ${fieldErrors.phone ? "border-destructive focus:ring-destructive" : ""}`} />
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* Step 1: Profile */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeading title={SECTIONS[1].title} description={SECTIONS[1].description} />
          <div className="space-y-4">
            <Field label="LinkedIn URL" id="apply-linkedin" error={fieldErrors.linkedinUrl} hint="Your public LinkedIn profile URL.">
              <div className="relative">
                <Linkedin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input id="apply-linkedin" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/your-name" className={`${INPUT_ICON} ${fieldErrors.linkedinUrl ? "border-destructive focus:ring-destructive" : ""}`} />
              </div>
            </Field>
            <Field label="Portfolio / GitHub / Other link" id="apply-portfolio" hint="Personal website, GitHub profile, Dribbble, or any other relevant link.">
              <div className="relative">
                <LinkIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input id="apply-portfolio" type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://github.com/your-username" className={INPUT_ICON} />
              </div>
            </Field>
            <Field label="Cover note" id="apply-summary" hint="A brief introduction or why you are excited about this role (optional).">
              <textarea id="apply-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Tell us a bit about yourself and why you are applying..." className={`${INPUT_PLAIN} resize-y`} />
            </Field>
          </div>
        </div>
      )}

      {/* Step 2 (optional): Custom Questions */}
      {currentStep === STEP_QUESTIONS && STEP_QUESTIONS !== -1 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeading title={SECTIONS[2].title} description={SECTIONS[2].description} />
          <div className="space-y-5">
            {customQuestions.map((q) => (
              <Field key={q.id} label={q.question} required={q.isRequired} id={`q-${q.id}`} error={fieldErrors[q.id]}>
                {q.type === "TEXTAREA" && (
                  <textarea
                    id={`q-${q.id}`}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={3}
                    className={`${INPUT_PLAIN} resize-y ${fieldErrors[q.id] ? "border-destructive" : ""}`}
                  />
                )}
                {q.type === "YES_NO" && (
                  <div className="flex gap-4">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className="accent-violet-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "SINGLE_SELECT" && (
                  <select
                    id={`q-${q.id}`}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className={`${INPUT_PLAIN} ${fieldErrors[q.id] ? "border-destructive" : ""}`}
                  >
                    <option value="">Select an option...</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {q.type === "MULTI_SELECT" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(answers[q.id] ?? "").split(",").includes(opt)}
                          onChange={(e) => {
                            const current = answers[q.id] ? answers[q.id].split(",").filter(Boolean) : [];
                            const updated = e.target.checked ? [...current, opt] : current.filter((v) => v !== opt);
                            setAnswers((prev) => ({ ...prev, [q.id]: updated.join(",") }));
                          }}
                          className="accent-violet-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === "NUMBER" && (
                  <input
                    id={`q-${q.id}`}
                    type="number"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className={`${INPUT_PLAIN} ${fieldErrors[q.id] ? "border-destructive" : ""}`}
                  />
                )}
                {(q.type === "TEXT" || !q.type) && (
                  <input
                    id={`q-${q.id}`}
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className={`${INPUT_PLAIN} ${fieldErrors[q.id] ? "border-destructive" : ""}`}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      )}

      {/* Resume step */}
      {currentStep === STEP_RESUME && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeading title={SECTIONS[STEP_RESUME].title} description={SECTIONS[STEP_RESUME].description} />
          <div
            role="button"
            tabIndex={0}
            onClick={() => cvInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cvInputRef.current?.click(); }
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {cvFile ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                  <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{cvFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(cvFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = ""; }} className="text-xs text-muted-foreground underline hover:text-foreground">Remove file</button>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Click to upload your CV</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX or TXT. Max 10 MB.</p>
                </div>
              </>
            )}
          </div>
          <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} className="sr-only" aria-label="Upload CV" tabIndex={-1} />
          {fieldErrors.cv && <p className="mt-2 text-xs text-destructive">{fieldErrors.cv}</p>}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition">
              <ArrowLeft className="h-4 w-4" />Back
            </button>
          )}
        </div>
        <div>
          {currentStep < SECTIONS.length - 1 ? (
            <button type="button" onClick={handleNext} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 active:scale-95 transition-all">
              Next
            </button>
          ) : (
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting...</> : "Submit application"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
