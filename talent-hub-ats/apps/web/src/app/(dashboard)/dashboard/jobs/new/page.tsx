"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, FileText, GitBranch } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { ScoringCriteriaEditor } from "@/components/jobs/scoring-criteria-editor";

const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "FREELANCE", label: "Freelance" },
];

const LEVELS = ["1","2","3","4","5","6","7","8","9"];

interface Location {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

interface PipelineTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  stages: { name: string; order: number }[];
}

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [openingParagraph, setOpeningParagraph] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [experienceLevel, setExperienceLevel] = useState("");
  const [pipelineTemplateId, setPipelineTemplateId] = useState("");
  const [pipelineTemplates, setPipelineTemplates] = useState<PipelineTemplate[]>([]);
  const [scoringCriteria, setScoringCriteria] = useState<string[]>([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/locations"))
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => setLocations([]));
    fetch(getApiUrl("/api/settings/pipeline-templates"))
      .then((res) => res.ok ? res.json() : [])
      .then((data: PipelineTemplate[]) => {
        setPipelineTemplates(Array.isArray(data) ? data : []);
        const defaultTmpl = data.find((t) => t.isDefault);
        if (defaultTmpl) setPipelineTemplateId(defaultTmpl.id);
      })
      .catch(() => {});
  }, []);

  const handleUseTemplate = async () => {
    setError(null);
    setLoadingTemplate(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/job-description-template"));
      const data = await res.json();
      if (res.ok && data.template) setDescription(data.template);
      else if (!res.ok) setError("Could not load template.");
    } catch {
      setError("Could not load template.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          openingParagraph: openingParagraph.trim() || undefined,
          description: description.trim() || "<p>No description provided.</p>",
          requirements: requirements.trim() || undefined,
          benefits: benefits.trim() || undefined,
          employmentType,
          experienceLevel: experienceLevel || undefined,
          locationId: locationId || undefined,
          pipelineTemplateId: pipelineTemplateId || undefined,
          scoringCriteria: JSON.stringify(scoringCriteria),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create job");
      router.push(`/dashboard/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Jobs
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Create Job</h1>
        <p className="text-muted-foreground mt-1">Add a new job posting and start receiving applications.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Senior Full Stack Engineer"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No location selected</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}{loc.city ? ` — ${loc.city}` : ""}{loc.country ? `, ${loc.country}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Employment type</label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {EMPLOYMENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Not set —</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </div>
        </div>
        {pipelineTemplates.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-muted-foreground" />
                Pipeline template
              </span>
            </label>
            <select
              value={pipelineTemplateId}
              onChange={(e) => setPipelineTemplateId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Standard (New, Screen, Interview, Offer, Hired)</option>
              {pipelineTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? " (default)" : ""} — {t.stages.map((s) => s.name).join(", ")}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Opening paragraph</label>
          <textarea
            value={openingParagraph}
            onChange={(e) => setOpeningParagraph(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="A short intro about [Company] and why this role matters..."
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium">Description *</label>
            <button
              type="button"
              onClick={handleUseTemplate}
              disabled={loadingTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {loadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Use template
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
            placeholder="Job description (plain text or HTML). Min 10 characters."
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Requirements (optional)</label>
          <p className="text-xs text-muted-foreground mb-1.5">Enter each requirement on a new line. Each line will appear as a bullet point.</p>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder={"5+ years of experience in backend development\nStrong knowledge of TypeScript\nExperience with PostgreSQL"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Technical scoring criteria (optional)</label>
          <p className="text-xs text-muted-foreground mb-1.5">Add criteria interviewers will rate on a 1-4 scale. These appear in the interview feedback form.</p>
          <ScoringCriteriaEditor value={scoringCriteria} onChange={setScoringCriteria} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Benefits (optional)</label>
          <textarea
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="e.g. Health insurance, 401k, PTO..."
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Link
            href="/dashboard/jobs"
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create job
          </button>
        </div>
      </form>
    </div>
  );
}
