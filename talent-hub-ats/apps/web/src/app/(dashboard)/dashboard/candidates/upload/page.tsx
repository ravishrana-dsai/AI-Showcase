"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  AlertCircle,
  Briefcase,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import { ResumeUpload } from "@/components/candidates/resume-upload";
import { getApiUrl } from "@/lib/api";

interface Job {
  id: string;
  title: string;
  department?: { name: string } | null;
  location?: { name: string } | null;
  _count?: { applications: number };
}

interface UploadResult {
  success: boolean;
  candidate?: any;
  application?: any;
  isDuplicate?: boolean;
  error?: string;
  parsed?: any;
  matchScore?: number;
  emailPending?: boolean;
}

export default function BulkUploadPage() {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    fetch(getApiUrl("/api/jobs/open"))
      .then((r) => r.json())
      .then((d) => setJobs(Array.isArray(d) ? d : (d.jobs ?? d.data ?? [])))
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, []);

  const successCount = results.filter((r) => r.success && !r.isDuplicate).length;
  const duplicateCount = results.filter((r) => r.success && r.isDuplicate).length;
  const errorCount = results.filter((r) => !r.success).length;
  const pipelineCount = results.filter((r) => r.application).length;

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Candidates
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Bulk Resume Upload</h1>
        <p className="text-muted-foreground mt-1">
          Upload resumes to create candidate profiles. Optionally map them to a
          job opening so they land directly in the pipeline.
        </p>
      </div>

      {/* Job selector */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Map to Job Pipeline (optional)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a job opening to automatically create an application and place
          each candidate in the first pipeline stage.
        </p>

        <div className="relative">
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            disabled={loadingJobs}
            className="w-full appearance-none rounded-lg border bg-background px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">No job selected — create profiles only</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
                {job.department ? ` · ${job.department.name}` : ""}
                {job.location ? ` · ${job.location.name}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>

        {selectedJob && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <Briefcase className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-primary font-medium">
              Candidates will be added to{" "}
              <span className="font-semibold">{selectedJob.title}</span> — first
              pipeline stage. Match scores will be calculated.
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{results.length} processed</span>
          </div>
          {successCount > 0 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{successCount} created</span>
            </div>
          )}
          {duplicateCount > 0 && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{duplicateCount} existing</span>
            </div>
          )}
          {pipelineCount > 0 && (
            <div className="flex items-center gap-2 text-blue-600">
              <GitBranch className="w-4 h-4" />
              <span className="text-sm font-medium">{pipelineCount} added to pipeline</span>
            </div>
          )}
          {errorCount > 0 && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{errorCount} failed</span>
            </div>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <div className="bg-card rounded-xl border p-6">
        <ResumeUpload
          mode="create_candidate"
          jobId={selectedJobId || undefined}
          multiple={true}
          onUploadComplete={(result) => {
            setResults((prev) => [...prev, result]);
          }}
        />
      </div>

      {/* Created Candidates */}
      {results.filter((r) => r.success && r.candidate).length > 0 && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-base font-semibold">Processed Candidates</h2>
          </div>
          <div className="divide-y">
            {results
              .filter((r) => r.success && r.candidate)
              .map((result, idx) => (
                <Link
                  key={idx}
                  href={
                    result.application
                      ? `/dashboard/jobs/${result.application.jobId}`
                      : `/dashboard/candidates/${result.candidate.id}`
                  }
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                    {result.candidate.firstName?.[0]}
                    {result.candidate.lastName?.[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {result.candidate.firstName} {result.candidate.lastName}
                      {result.isDuplicate && (
                        <span className="ml-2 text-xs text-amber-600 font-normal">
                          existing candidate
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.candidate.email}
                      {result.emailPending && (
                        <span className="text-amber-700 dark:text-amber-500">
                          {" "}
                          · add email in profile
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {result.application && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                        <GitBranch className="w-3 h-3" />
                        {result.application.currentStage?.name ?? "In pipeline"}
                      </span>
                    )}
                    {result.parsed?.skills?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {result.parsed.skills.length} skills
                      </span>
                    )}
                    {result.matchScore != null && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          result.matchScore >= 70
                            ? "bg-green-100 text-green-700"
                            : result.matchScore >= 40
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {result.matchScore}% match
                      </span>
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
