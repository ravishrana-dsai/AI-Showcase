"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  AlertCircle,
  Upload,
  CheckCircle,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkedInImportDialog } from "@/components/candidates/linkedin-import-dialog";
import { DuplicateDetectionBanner } from "@/components/candidates/duplicate-detection-banner";
import type { LinkedInProfileData } from "@/lib/linkedin/linkedin-types";
import type { DuplicateMatch } from "@/lib/candidates/duplicate-detection";
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

type Tab = "upload" | "manual" | "linkedin";

interface ParsedExperienceItem {
  title?: string;
  company?: string;
  duration?: string;
}

interface ParsedEducationItem {
  degree?: string;
  institution?: string;
}

interface ParsedData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  skills?: string[];
  experience?: (string | ParsedExperienceItem)[];
  education?: (string | ParsedEducationItem)[];
  summary?: string;
}

export default function NewCandidatePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkedInDialog, setShowLinkedInDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  // CV upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [parsedSkills, setParsedSkills] = useState<string[]>([]);
  const [cvFileUrl, setCvFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  // Check for duplicate candidates when email field loses focus
  async function checkDuplicates(email: string) {
    if (!email.trim()) return;
    const res = await fetch(getApiUrl("/api/candidates/check-duplicates"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), firstName: form.firstName, lastName: form.lastName }),
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => ({}));
    setDuplicates(data.duplicates ?? []);
  }

  function handleLinkedInImport(profile: LinkedInProfileData) {
    setShowLinkedInDialog(false);
    setActiveTab("manual");
    setForm((prev) => ({
      ...prev,
      firstName: profile.firstName || prev.firstName,
      lastName: profile.lastName || prev.lastName,
      email: profile.email || prev.email,
      currentTitle: profile.currentTitle || prev.currentTitle,
      currentCompany: profile.currentCompany || prev.currentCompany,
      location: profile.location || prev.location,
      linkedinUrl: profile.linkedinUrl || prev.linkedinUrl,
      source: prev.source || "LinkedIn",
    }));
  }

  // CV Upload & Parse
  const handleFileUpload = useCallback(
    async (file: File) => {
      const validTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a PDF, DOCX, DOC, or TXT file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be under 10MB.");
        return;
      }

      setUploadedFile(file);
      setIsParsing(true);
      setError(null);
      setParsedData(null);
      setParsedSkills([]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", "parse_only");

        const res = await fetch(getApiUrl("/api/upload"), {
          method: "POST",
          body: formData,
        });

        const result = await res.json();

        if (result.success && result.parsed) {
          const p = result.parsed as ParsedData;
          setParsedData(p);
          setParsedSkills(p.skills || []);
          if (result.file?.storedAs) {
            setCvFileUrl(getApiUrl(`/api/files/${result.file.storedAs}`));
          }

          // First experience entry → current title & company for easy correction
          const firstExp = p.experience?.[0];
          const expTitle =
            typeof firstExp === "object" && firstExp && "title" in firstExp
              ? (firstExp as ParsedExperienceItem).title
              : undefined;
          const expCompany =
            typeof firstExp === "object" && firstExp && "company" in firstExp
              ? (firstExp as ParsedExperienceItem).company
              : undefined;

          // Auto-fill the form with parsed data
          setForm((prev) => ({
            ...prev,
            firstName: p.firstName || prev.firstName,
            lastName: p.lastName || prev.lastName,
            email: p.email || prev.email,
            phone: p.phone || prev.phone,
            location: p.location || prev.location,
            currentCompany: expCompany || prev.currentCompany,
            currentTitle: expTitle || prev.currentTitle,
            linkedinUrl: p.linkedinUrl || prev.linkedinUrl,
            portfolioUrl: p.portfolioUrl || prev.portfolioUrl,
            summary: p.summary || prev.summary,
            source: prev.source || "Direct Application",
          }));
        } else {
          setError(result.error || "Failed to parse resume. You can still fill in the details manually.");
        }
      } catch {
        setError("Failed to upload and parse resume. You can still fill in the details manually.");
      } finally {
        setIsParsing(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearUpload = () => {
    setUploadedFile(null);
    setParsedData(null);
    setParsedSkills([]);
    setCvFileUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl("/api/candidates/create"), {
        method: "POST",
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
        setError(data.error || "Failed to create candidate");
        setIsSubmitting(false);
        return;
      }

      const candidateId = data.candidate.id;

      // If we have an uploaded file, attach it to the newly created candidate
      if (uploadedFile) {
        try {
          const formData = new FormData();
          formData.append("file", uploadedFile);
          formData.append("mode", "attach");
          formData.append("candidateId", candidateId);

          await fetch(getApiUrl("/api/upload"), {
            method: "POST",
            body: formData,
          });
        } catch {
          // Non-critical: candidate was created, resume attachment failed silently
          console.error("Failed to attach resume to candidate");
        }
      }

      router.push(`/dashboard/candidates/${candidateId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {showLinkedInDialog && (
        <LinkedInImportDialog
          onImport={handleLinkedInImport}
          onClose={() => setShowLinkedInDialog(false)}
        />
      )}
      {/* Back link */}
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Add New Candidate</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CV to auto-fill details, or enter them manually.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "upload"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="w-4 h-4" />
          Upload CV
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "manual"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="w-4 h-4" />
          Manual Entry
        </button>
        <button
          type="button"
          onClick={() => setShowLinkedInDialog(true)}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
            activeTab === "linkedin"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Linkedin className="w-4 h-4" />
          Import from LinkedIn
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload CV Section */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          {/* Drop Zone */}
          {!uploadedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
              <Upload
                className={cn(
                  "w-12 h-12 mx-auto mb-4",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
              <p className="text-base font-medium">
                {isDragging
                  ? "Drop your CV here"
                  : "Drag & drop a CV here, or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports PDF, DOCX, DOC, TXT (max 10MB)
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                We'll automatically extract name, email, phone, skills, and more
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                {isParsing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing...
                  </div>
                ) : parsedData ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle className="w-4 h-4" />
                    Parsed
                  </div>
                ) : null}
                {cvFileUrl && (
                  <a
                    href={cvFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-info hover:bg-info/10 transition-colors"
                    title="Open CV in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View CV
                  </a>
                )}
                <button
                  type="button"
                  onClick={clearUpload}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Parsed info banner */}
              {parsedData && (
                <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-success" />
                    <p className="text-sm font-medium text-success">
                      Auto-filled from CV
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We extracted the candidate's details below. Review and edit
                    as needed, then click "Add Candidate" to save.
                  </p>
                </div>
              )}

              {/* Parsed Skills */}
              {parsedSkills.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Detected Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Parsed Experience */}
              {parsedData?.experience && parsedData.experience.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Experience
                  </p>
                  <ul className="space-y-1">
                    {parsedData.experience.slice(0, 5).map((exp, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground flex items-start gap-2"
                      >
                        <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                        {typeof exp === "string"
                          ? exp
                          : [exp.title, exp.company, exp.duration]
                              .filter(Boolean)
                              .join(" · ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Parsed Education */}
              {parsedData?.education && parsedData.education.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Education
                  </p>
                  <ul className="space-y-1">
                    {parsedData.education.slice(0, 3).map((edu, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground flex items-start gap-2"
                      >
                        <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                        {typeof edu === "string"
                          ? edu
                          : [edu.degree, edu.institution]
                              .filter(Boolean)
                              .join(" – ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* After parsing, show the form below */}
          {(parsedData || isParsing) && !isParsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>Review & edit details below</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}
        </div>
      )}

      {duplicates.length > 0 && (
        <DuplicateDetectionBanner
          duplicates={duplicates}
          newCandidateData={{ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone || undefined }}
          onDismiss={() => setDuplicates([])}
        />
      )}

      {/* Form - always visible when manual tab, or after CV parse */}
      {(activeTab === "manual" || parsedData) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
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
                    placeholder="e.g. Aarav"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                    placeholder="e.g. Patel"
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
                    onBlur={(e) => checkDuplicates(e.target.value)}
                    required
                    placeholder="e.g. aarav.patel@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="e.g. +91-98765-43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Professional Info */}
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
              Professional Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Current Company
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    name="currentCompany"
                    value={form.currentCompany}
                    onChange={handleChange}
                    placeholder="e.g. Flipkart"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Current Title
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    name="currentTitle"
                    value={form.currentTitle}
                    onChange={handleChange}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g. Bangalore, Karnataka"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
              Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  LinkedIn URL
                </label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    name="linkedinUrl"
                    value={form.linkedinUrl}
                    onChange={handleChange}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Portfolio / Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="url"
                    name="portfolioUrl"
                    value={form.portfolioUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Compensation & availability */}
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
              Compensation & availability
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Expected CTC
                </label>
                <input
                  type="text"
                  name="expectedCtc"
                  value={form.expectedCtc}
                  onChange={handleChange}
                  placeholder="e.g. 25 LPA (INR)"
                  className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Notice period
                </label>
                <input
                  type="text"
                  name="noticePeriod"
                  value={form.noticePeriod}
                  onChange={handleChange}
                  placeholder="e.g. 2 weeks, 1 month, Immediate"
                  className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Source */}
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">
              Source
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Source Channel
                </label>
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
                <label className="block text-sm font-medium mb-1.5">
                  Source Detail
                </label>
                <input
                  type="text"
                  name="sourceDetail"
                  value={form.sourceDetail}
                  onChange={handleChange}
                  placeholder="e.g. Referred by Bhanvi Kumar"
                  className="w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
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
                placeholder="Brief summary about the candidate, initial impressions, or notes..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/dashboard/candidates"
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
                  Creating...
                </>
              ) : (
                <>
                  {uploadedFile && <Upload className="w-4 h-4" />}
                  Add Candidate{uploadedFile ? " & Attach CV" : ""}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
