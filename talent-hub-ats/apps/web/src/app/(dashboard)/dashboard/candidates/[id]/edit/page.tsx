"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  MapPin,
  Linkedin,
  Globe,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

const SOURCE_OPTIONS = [
  "LinkedIn",
  "Naukri",
  "Referral",
  "Career Page",
  "Indeed",
  "Glassdoor",
  "Agency",
  "Job Fair",
  "Direct Application",
  "Other",
];

export default function EditCandidatePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [candidate, setCandidate] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentCompany: "",
    currentTitle: "",
    location: "",
    linkedinUrl: "",
    portfolioUrl: "",
    source: "",
    sourceDetail: "",
    summary: "",
    expectedCtc: "",
    noticePeriod: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(getApiUrl(`/api/candidates/${id}`));
        if (res.status === 404) {
          router.replace("/dashboard/candidates");
          return;
        }
        if (!res.ok) throw new Error("Failed to load candidate");
        const data = await res.json();
        setCandidate(data.candidate);
        setForm({
          firstName: data.candidate.firstName ?? "",
          lastName: data.candidate.lastName ?? "",
          email: data.candidate.email ?? "",
          phone: data.candidate.phone ?? "",
          currentCompany: data.candidate.currentCompany ?? "",
          currentTitle: data.candidate.currentTitle ?? "",
          location: data.candidate.location ?? "",
          linkedinUrl: data.candidate.linkedinUrl ?? "",
          portfolioUrl: data.candidate.portfolioUrl ?? "",
          source: data.candidate.source ?? "",
          sourceDetail: data.candidate.sourceDetail ?? "",
          summary: data.candidate.summary ?? "",
          expectedCtc: data.candidate.expectedCtc ?? "",
          noticePeriod: data.candidate.noticePeriod ?? "",
        });
      } catch {
        setError("Failed to load candidate");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError("A candidate with this email already exists.");
        setIsSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Failed to update candidate");
        setIsSubmitting(false);
        return;
      }
      router.push(`/dashboard/candidates/${id}`);
      router.refresh();
    } catch {
      setError("Failed to update candidate");
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!candidate) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/candidates/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to candidate
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Edit candidate</h1>
        <p className="text-muted-foreground mt-0.5">
          Correct or update details (e.g. after CV parse).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                First Name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Last Name <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Email <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Professional Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Company</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="currentCompany"
                  value={form.currentCompany}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Title</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="currentTitle"
                  value={form.currentTitle}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">LinkedIn URL</label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  name="linkedinUrl"
                  value={form.linkedinUrl}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Portfolio / Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  name="portfolioUrl"
                  value={form.portfolioUrl}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Compensation & availability
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Expected CTC</label>
              <input
                type="text"
                name="expectedCtc"
                value={form.expectedCtc}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Notice period</label>
              <input
                type="text"
                name="noticePeriod"
                value={form.noticePeriod}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Source
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Source Channel</label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select source...</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Source Detail</label>
              <input
                type="text"
                name="sourceDetail"
                value={form.sourceDetail}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
            Summary / Notes
          </h2>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <textarea
              name="summary"
              value={form.summary}
              onChange={handleChange}
              rows={4}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/dashboard/candidates/${id}`}
            className="px-5 py-2.5 rounded-lg border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
