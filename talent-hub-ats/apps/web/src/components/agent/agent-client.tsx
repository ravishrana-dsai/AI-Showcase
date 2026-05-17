"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Briefcase, Linkedin, UserPlus, Building2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { StepCard, type StepStatus } from "./step-card";
import { CandidateScoreList, type ScoredCandidate } from "./candidate-score-list";
import { EmailPreview, type DraftEmail } from "./email-preview";
import { MarkdownOutput } from "./markdown-output";
import { RunHistory } from "./run-history";
import { Phase2Stubs } from "./phase2-stubs";
import { SourcedCandidates, type SourcedCandidate } from "./sourced-candidates";
import { TargetCompanies, type TargetCompany } from "./target-companies";

interface Job {
  id: string;
  title: string;
  status: string;
  departmentName: string | null;
}

interface AgentClientProps {
  jobs: Job[];
}

type AgentStep = "jd_polish" | "candidate_matching" | "email_drafting" | "interview_prep";

const STEPS: { key: AgentStep; title: string; description: string; approveLabel: string }[] = [
  {
    key: "jd_polish",
    title: "Polish Job Description",
    description: "AI rewrites the JD for clarity, structure, and flags biased language.",
    approveLabel: "Approve & Save",
  },
  {
    key: "candidate_matching",
    title: "Match Candidates",
    description: "Score and rank all ATS candidates against this role.",
    approveLabel: "Approve Shortlist",
  },
  {
    key: "email_drafting",
    title: "Draft Outreach Emails",
    description: "Generate a personalised email for each shortlisted candidate.",
    approveLabel: "Send All",
  },
  {
    key: "interview_prep",
    title: "Interview Prep Guide",
    description: "Generate a structured question bank grouped by competency.",
    approveLabel: "Save as Template",
  },
];

// Parse scored candidates from the agent's markdown output
// Format: **[Score]/100 - [Name]** (id:[candidateId])
// [Title] at [Company] | [email] | [location]
// Tags: [tag1, tag2]
// Rationale: [text]
function parseCandidates(text: string): ScoredCandidate[] {
  const results: ScoredCandidate[] = [];
  // Match: **85/100 - Jane Smith** (id:clxyz123)
  const regex = /\*\*(\d+)\/100\s*-\s*([^*(]+)\*\*(?:\s*\(id:([^)]+)\))?/g;
  let match;
  let index = 0;
  while ((match = regex.exec(text)) !== null) {
    const score = parseInt(match[1], 10);
    const name = match[2].trim();
    const profileId = match[3]?.trim();
    const afterMatch = text.slice(match.index + match[0].length).trimStart();
    const lines = afterMatch.split("\n").map((l) => l.trim());

    // Line 0: "Title at Company | email | location"
    const infoLine = lines[0] ?? "";
    const infoParts = infoLine.split("|").map((p) => p.trim());
    const titleCompany = infoParts[0] ?? "";
    const email = infoParts[1] ?? "";
    const location = infoParts[2] ?? "";
    const titleParts = titleCompany.split(" at ");
    const title = titleParts[0]?.trim();
    const company = titleParts[1]?.trim();

    // Line 1 may be "Tags: tag1, tag2" or "Rationale: ..."
    let tags: string[] = [];
    let rationaleText = "";
    for (const line of lines.slice(1, 4)) {
      if (line.toLowerCase().startsWith("tags:")) {
        tags = line.slice(5).split(",").map((t) => t.trim()).filter(Boolean);
      } else if (line.toLowerCase().startsWith("rationale:")) {
        rationaleText = line.slice(10).trim();
      }
    }

    results.push({
      id: profileId ?? `parsed-${index}`,
      profileId: profileId || undefined,
      name,
      score,
      rationale: rationaleText,
      title: title || undefined,
      company: company || undefined,
      email: email || undefined,
      location: location || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    index++;
  }
  return results.sort((a, b) => b.score - a.score);
}

// Parse email drafts from the agent's markdown output
function parseEmails(text: string): DraftEmail[] {
  const emails: DraftEmail[] = [];
  // Split by the --- separator
  const blocks = text.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const toMatch = block.match(/\*\*To:\*\*\s*(.+?)(?:\s*<([^>]+)>)?(?:\n|$)/);
    const subjectMatch = block.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|$)/);
    const bodyStart = block.indexOf("\n\n");
    if (!toMatch || !subjectMatch || bodyStart === -1) continue;

    const rawName = toMatch[1].trim().replace(/<[^>]+>/, "").trim();
    const email = toMatch[2]?.trim() ?? "";
    const subject = subjectMatch[1].trim();
    const body = block.slice(bodyStart).trim();

    emails.push({
      candidateId: `email-${emails.length}`,
      candidateName: rawName,
      to: email || rawName,
      subject,
      body,
    });
  }
  return emails;
}

export function AgentClient({ jobs }: AgentClientProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [statuses, setStatuses] = useState<Record<AgentStep, StepStatus>>({
    jd_polish: "idle",
    candidate_matching: "idle",
    email_drafting: "idle",
    interview_prep: "idle",
  });
  const [outputs, setOutputs] = useState<Record<AgentStep, string>>({
    jd_polish: "",
    candidate_matching: "",
    email_drafting: "",
    interview_prep: "",
  });
  const [candidates, setCandidates] = useState<ScoredCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [emailDrafts, setEmailDrafts] = useState<DraftEmail[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"sourcing" | "pipeline">("sourcing");

  // Company Intel state (independent sourcing pre-step)
  const [companyIntelStatus, setCompanyIntelStatus] = useState<StepStatus>("idle");
  const [companyIntelOutput, setCompanyIntelOutput] = useState("");
  const [targetCompanies, setTargetCompanies] = useState<TargetCompany[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  // LinkedIn sourcing state (independent of the 4-step flow)
  const [linkedinStatus, setLinkedinStatus] = useState<StepStatus>("idle");
  const [linkedinOutput, setLinkedinOutput] = useState("");
  const [sourcedCandidates, setSourcedCandidates] = useState<SourcedCandidate[]>([]);
  const [selectedSourced, setSelectedSourced] = useState<Set<string>>(new Set());
  const [importingLinkedin, setImportingLinkedin] = useState(false);
  const [linkedinFilters, setLinkedinFilters] = useState({
    location: "",
    companies: "",
    keywords: "",
  });

  const setStatus = useCallback((step: AgentStep, status: StepStatus) => {
    setStatuses((prev) => ({ ...prev, [step]: status }));
  }, []);

  const appendOutput = useCallback((step: AgentStep, chunk: string) => {
    setOutputs((prev) => ({ ...prev, [step]: prev[step] + chunk }));
  }, []);

  const resetStep = useCallback((step: AgentStep) => {
    setOutputs((prev) => ({ ...prev, [step]: "" }));
    setStatus(step, "idle");
  }, [setStatus]);

  function isStepEnabled(index: number): boolean {
    if (index === 0) return true;
    const prevStep = STEPS[index - 1].key;
    return statuses[prevStep] === "approved" || statuses[prevStep] === "skipped";
  }

  async function runStep(step: AgentStep) {
    if (!selectedJobId) {
      toast.error("Please select a job first");
      return;
    }

    // Reset output and start
    setOutputs((prev) => ({ ...prev, [step]: "" }));
    setStatus(step, "running");

    abortRef.current = new AbortController();

    try {
      const context =
        step === "email_drafting" && selectedCandidates.size > 0
          ? `Shortlisted candidate IDs to draft emails for: ${[...selectedCandidates].join(", ")}`
          : undefined;

      const res = await fetch(getApiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, step, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; chunk?: string; message?: string };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "text" && event.chunk) {
            appendOutput(step, event.chunk);
          } else if (event.type === "done") {
            setStatus(step, "needs_review");
            // Post-process outputs
            if (step === "candidate_matching") {
              setOutputs((prev) => {
                setCandidates(parseCandidates(prev[step]));
                return prev;
              });
            }
            if (step === "email_drafting") {
              setOutputs((prev) => {
                setEmailDrafts(parseEmails(prev[step]));
                return prev;
              });
            }
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Agent error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Agent request failed");
      setStatus(step, "idle");
    }
  }

  async function approveJdPolish() {
    if (!selectedJobId || !outputs.jd_polish) return;
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${selectedJobId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: outputs.jd_polish }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Job description updated");
      setStatus("jd_polish", "approved");
    } catch {
      toast.error("Failed to save job description");
    }
  }

  async function approveCandidateMatching() {
    if (selectedCandidates.size === 0) {
      toast.error("Select at least one candidate to proceed");
      return;
    }
    // Create pipeline applications for each selected candidate
    let created = 0;
    let skipped = 0;
    for (const candidateId of selectedCandidates) {
      // Only create if candidateId looks like a real DB id (not a parsed-N fallback)
      if (candidateId.startsWith("parsed-")) { skipped++; continue; }
      try {
        const res = await fetch(getApiUrl("/api/applications/create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId, jobId: selectedJobId, source: "Agent Shortlist" }),
        });
        if (res.ok) created++;
        else if (res.status === 409) skipped++; // already applied
      } catch {
        skipped++;
      }
    }
    setStatus("candidate_matching", "approved");
    if (created > 0) {
      toast.success(`${created} candidate(s) added to pipeline${skipped > 0 ? `, ${skipped} already applied` : ""}`);
    } else if (skipped > 0) {
      toast.success(`${skipped} candidate(s) already in pipeline`);
    } else {
      toast.success(`${selectedCandidates.size} candidate(s) shortlisted`);
    }
  }

  async function approveEmailDrafting() {
    if (emailDrafts.length === 0) return;
    let sent = 0;
    for (const email of emailDrafts) {
      try {
        const res = await fetch(getApiUrl("/api/email/send"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email.to,
            subject: email.subject,
            body: email.body,
          }),
        });
        if (res.ok) sent++;
      } catch {
        // continue with others
      }
    }
    toast.success(`${sent} of ${emailDrafts.length} emails queued`);
    setStatus("email_drafting", "approved");
  }

  async function approveInterviewPrep() {
    // Save as a note or log — scorecard template creation requires a full form
    // For now mark as approved and show a success message
    toast.success("Interview guide ready. Copy it to create a scorecard template.");
    setStatus("interview_prep", "approved");
  }

  function handleApprove(step: AgentStep) {
    switch (step) {
      case "jd_polish": return approveJdPolish();
      case "candidate_matching": return approveCandidateMatching();
      case "email_drafting": return approveEmailDrafting();
      case "interview_prep": return approveInterviewPrep();
    }
  }

  function handleSkip(step: AgentStep) {
    if (abortRef.current) abortRef.current.abort();
    setStatus(step, "skipped");
  }

  function handleRegenerate(step: AgentStep) {
    resetStep(step);
    runStep(step);
  }

  // Parse **[Name]** (linkedin:[URL]) blocks from LLM output
  function parseSourcedCandidates(text: string): SourcedCandidate[] {
    const results: SourcedCandidate[] = [];
    // Match: **Jane Smith** (linkedin:https://linkedin.com/in/janesmith)
    const regex = /\*\*([^*]+)\*\*\s*\(linkedin:(https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim();
      const linkedinUrl = match[2].trim();
      if (!name || !linkedinUrl) continue;

      // Derive a stable ID from the URL slug
      const slug = linkedinUrl.split("/in/")[1]?.replace(/\/$/, "") ?? linkedinUrl;
      const id = slug.slice(0, 60);

      // Parse next line: "Title at Company"
      const afterMatch = text.slice(match.index + match[0].length).trimStart();
      const firstLine = afterMatch.split("\n")[0]?.trim() ?? "";
      const atIdx = firstLine.indexOf(" at ");
      const title = atIdx !== -1 ? firstLine.slice(0, atIdx).trim() || null : firstLine || null;
      const company = atIdx !== -1 ? firstLine.slice(atIdx + 4).trim() || null : null;

      // Summary: next non-empty line after the title line
      const lines = afterMatch.split("\n").map((l) => l.trim());
      const summary = lines.slice(1).find((l) => l && !l.startsWith("**")) ?? null;

      results.push({ id, name, linkedinUrl, title, company, summary: summary || null });
    }
    return results;
  }

  // Parse company table from agent output
  // Format: | Company | Why a strong source | Approx. size | Confidence |
  function parseTargetCompanies(text: string): TargetCompany[] {
    const results: TargetCompany[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line.trim().startsWith("|")) continue;
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      // Skip header and separator rows
      if (cells[0].toLowerCase() === "company" || /^[-: ]+$/.test(cells[0])) continue;
      const name = cells[0];
      const why = cells[1] ?? "";
      const size = cells[2] ?? null;
      const rawConf = (cells[3] ?? "").toLowerCase();
      const confidence: TargetCompany["confidence"] = rawConf.includes("high")
        ? "High"
        : rawConf.includes("medium")
        ? "Medium"
        : "Low";
      if (!name || !why) continue;
      results.push({
        id: name.toLowerCase().replace(/\s+/g, "-").slice(0, 40),
        name,
        why,
        size: size || null,
        confidence,
      });
    }
    return results;
  }

  async function runCompanyIntel() {
    if (!selectedJobId) {
      toast.error("Please select a job first");
      return;
    }
    setCompanyIntelOutput("");
    setCompanyIntelStatus("running");
    setTargetCompanies([]);
    setSelectedCompanies(new Set());

    abortRef.current = new AbortController();
    try {
      const res = await fetch(getApiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, step: "company_intel" }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; chunk?: string; message?: string };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "text" && event.chunk) {
            fullText += event.chunk;
            setCompanyIntelOutput(fullText);
          } else if (event.type === "done") {
            setCompanyIntelStatus("needs_review");
            setTargetCompanies(parseTargetCompanies(fullText));
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Agent error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Company intel failed");
      setCompanyIntelStatus("idle");
    }
  }

  function handleCompaniesSelected() {
    const names = [...selectedCompanies]
      .map((id) => targetCompanies.find((c) => c.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    setLinkedinFilters((prev) => ({ ...prev, companies: names.join(", ") }));
    toast.success(
      `${names.length} ${names.length === 1 ? "company" : "companies"} added to LinkedIn filter. Click "Source from LinkedIn" to search.`
    );
  }

  async function runLinkedinSourcing() {
    if (!selectedJobId) {
      toast.error("Please select a job first");
      return;
    }
    setLinkedinOutput("");
    setLinkedinStatus("running");
    setSourcedCandidates([]);
    setSelectedSourced(new Set());

    // Build context from recruiter-provided filters
    const contextParts: string[] = [];
    if (linkedinFilters.location.trim()) {
      contextParts.push(`Location preference: ${linkedinFilters.location.trim()}`);
    }
    if (linkedinFilters.companies.trim()) {
      contextParts.push(`Target companies: ${linkedinFilters.companies.trim()}`);
    }
    if (linkedinFilters.keywords.trim()) {
      contextParts.push(`Additional keywords: ${linkedinFilters.keywords.trim()}`);
    }
    const context = contextParts.length > 0 ? contextParts.join("\n") : undefined;

    abortRef.current = new AbortController();
    try {
      const res = await fetch(getApiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId, step: "linkedin_sourcing", context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; chunk?: string; message?: string };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "text" && event.chunk) {
            fullText += event.chunk;
            setLinkedinOutput(fullText);
          } else if (event.type === "done") {
            setLinkedinStatus("needs_review");
            setSourcedCandidates(parseSourcedCandidates(fullText));
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Agent error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error(err);
      toast.error(err instanceof Error ? err.message : "LinkedIn sourcing failed");
      setLinkedinStatus("idle");
    }
  }

  async function importSelectedLinkedin() {
    if (selectedSourced.size === 0) {
      toast.error("Select at least one profile to import");
      return;
    }
    setImportingLinkedin(true);
    const toImport = sourcedCandidates.filter((c) => selectedSourced.has(c.id));

    try {
      const res = await fetch(getApiUrl("/api/agent/import-candidates"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: toImport.map((c) => ({
            name: c.name,
            linkedinUrl: c.linkedinUrl,
            title: c.title,
            company: c.company,
            summary: c.summary,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }

      const { imported, duplicates } = data as { imported: number; duplicates: number };

      // Mark imported candidates visually
      setSourcedCandidates((prev) =>
        prev.map((c) =>
          selectedSourced.has(c.id) && !c.imported ? { ...c, imported: true } : c
        )
      );
      setSelectedSourced(new Set());
      setLinkedinStatus("approved");

      if (imported > 0) {
        toast.success(
          `${imported} candidate(s) imported to ATS${duplicates > 0 ? `, ${duplicates} already existed` : ""}`
        );
      } else if (duplicates > 0) {
        toast.success(`${duplicates} candidate(s) already in ATS`);
      } else {
        toast.success("Import complete");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingLinkedin(false);
    }
  }

  function handleJobChange(jobId: string) {
    setSelectedJobId(jobId);
    // Reset all steps when job changes
    setStatuses({ jd_polish: "idle", candidate_matching: "idle", email_drafting: "idle", interview_prep: "idle" });
    setOutputs({ jd_polish: "", candidate_matching: "", email_drafting: "", interview_prep: "" });
    setCandidates([]);
    setSelectedCandidates(new Set());
    setEmailDrafts([]);
    // Reset LinkedIn sourcing
    setLinkedinStatus("idle");
    setLinkedinOutput("");
    setSourcedCandidates([]);
    setSelectedSourced(new Set());
    setLinkedinFilters({ location: "", companies: "", keywords: "" });
    // Reset Company Intel
    setCompanyIntelStatus("idle");
    setCompanyIntelOutput("");
    setTargetCompanies([]);
    setSelectedCompanies(new Set());
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div className="space-y-6">
      {/* Job selector */}
      <div className="rounded-xl border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label htmlFor="job-select" className="block text-sm font-medium mb-1.5">
              Select a job to run the agent on
            </label>
            <select
              id="job-select"
              value={selectedJobId}
              onChange={(e) => handleJobChange(e.target.value)}
              className="w-full max-w-sm rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose a job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.departmentName ? ` — ${j.departmentName}` : ""}
                  {" "}({j.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedJob && (
          <p className="mt-2 ml-8 text-xs text-muted-foreground">
            Running agent for: <span className="font-medium text-foreground">{selectedJob.title}</span>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border w-fit">
        <button
          onClick={() => setActiveTab("sourcing")}
          className={[
            "text-sm px-4 py-1.5 rounded-lg font-medium transition-colors",
            activeTab === "sourcing"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Sourcing
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={[
            "text-sm px-4 py-1.5 rounded-lg font-medium transition-colors",
            activeTab === "pipeline"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Pipeline
        </button>
      </div>

      {activeTab === "sourcing" && (
        <>
          {/* Company Intel */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Company Intel</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 font-medium">
                  AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                {companyIntelStatus === "idle" || companyIntelStatus === "skipped" ? (
                  <button
                    onClick={runCompanyIntel}
                    disabled={!selectedJobId}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Find Target Companies
                  </button>
                ) : companyIntelStatus === "running" ? (
                  <button
                    onClick={() => { abortRef.current?.abort(); setCompanyIntelStatus("idle"); }}
                    className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted/40 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={() => { setCompanyIntelStatus("idle"); setCompanyIntelOutput(""); setTargetCompanies([]); setSelectedCompanies(new Set()); }}
                    className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted/40 font-medium transition-colors"
                  >
                    Re-run
                  </button>
                )}
              </div>
            </div>

            <div className="px-5 py-3">
              {companyIntelStatus === "idle" && (
                <p className="text-xs text-muted-foreground py-1">
                  Claude identifies the best companies to source candidates from based on the job requirements. No external search credits used.
                </p>
              )}
              {companyIntelStatus === "running" && (
                <MarkdownOutput content={companyIntelOutput} streaming />
              )}
              {(companyIntelStatus === "needs_review" || companyIntelStatus === "approved") && (
                <TargetCompanies
                  companies={targetCompanies}
                  selected={selectedCompanies}
                  onToggle={(id) =>
                    setSelectedCompanies((prev) => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    })
                  }
                  onSourceSelected={handleCompaniesSelected}
                />
              )}
            </div>
          </div>

          {/* LinkedIn Sourcing (independent section, does not block the 4 steps) */}
          <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Linkedin className="h-4 w-4 text-[#0A66C2]" />
            <span className="text-sm font-medium">LinkedIn Sourcing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">
              New
            </span>
          </div>
          <div className="flex items-center gap-2">
            {linkedinStatus === "idle" || linkedinStatus === "skipped" ? (
              <button
                onClick={runLinkedinSourcing}
                disabled={!selectedJobId}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Source from LinkedIn
              </button>
            ) : linkedinStatus === "running" ? (
              <button
                onClick={() => { abortRef.current?.abort(); setLinkedinStatus("idle"); }}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted/40 font-medium transition-colors"
              >
                Cancel
              </button>
            ) : (
              <>
                {selectedSourced.size > 0 && (
                  <button
                    onClick={importSelectedLinkedin}
                    disabled={importingLinkedin}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 font-medium transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {importingLinkedin ? "Importing..." : `Import ${selectedSourced.size} selected`}
                  </button>
                )}
                <button
                  onClick={() => { setLinkedinStatus("idle"); setLinkedinOutput(""); setSourcedCandidates([]); setSelectedSourced(new Set()); }}
                  className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted/40 font-medium transition-colors"
                >
                  Re-run
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3">
          {linkedinStatus === "idle" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={linkedinFilters.location}
                    onChange={(e) => setLinkedinFilters((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. Bangalore, Remote"
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Target Companies
                  </label>
                  <input
                    type="text"
                    value={linkedinFilters.companies}
                    onChange={(e) => setLinkedinFilters((prev) => ({ ...prev, companies: e.target.value }))}
                    placeholder="e.g. Flipkart, Amazon, Swiggy"
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Extra Keywords
                  </label>
                  <input
                    type="text"
                    value={linkedinFilters.keywords}
                    onChange={(e) => setLinkedinFilters((prev) => ({ ...prev, keywords: e.target.value }))}
                    placeholder="e.g. fintech, React Native"
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                All filters are optional. Leave blank to let the agent infer from the job description.
              </p>
            </div>
          )}
          {linkedinStatus === "running" && (
            <MarkdownOutput content={linkedinOutput} streaming />
          )}
          {(linkedinStatus === "needs_review" || linkedinStatus === "approved") && (
            <SourcedCandidates
              candidates={sourcedCandidates}
              selected={selectedSourced}
              onToggle={(id) =>
                setSelectedSourced((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
            />
          )}
        </div>
      </div>
        </>
      )}

      {activeTab === "pipeline" && (
        <>
          {STEPS.map((step, index) => (
            <StepCard
              key={step.key}
              stepNumber={index + 1}
              title={step.title}
              description={step.description}
              status={statuses[step.key]}
              disabled={!selectedJobId || !isStepEnabled(index)}
              onRun={() => runStep(step.key)}
              onApprove={() => handleApprove(step.key)}
              onRegenerate={() => handleRegenerate(step.key)}
              onSkip={() => handleSkip(step.key)}
              approveLabel={step.approveLabel}
            >
              {/* Step-specific output rendering */}
              {step.key === "jd_polish" && outputs.jd_polish && (
                statuses.jd_polish === "running" ? (
                  <MarkdownOutput content={outputs.jd_polish} streaming />
                ) : (
                  <div className="space-y-2">
                    <MarkdownOutput content={outputs.jd_polish} className="max-h-[500px] overflow-y-auto" />
                    <textarea
                      className="w-full min-h-[200px] rounded-lg border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring mt-2"
                      placeholder="Edit the generated JD before approving..."
                      value={outputs.jd_polish}
                      onChange={(e) =>
                        setOutputs((prev) => ({ ...prev, jd_polish: e.target.value }))
                      }
                    />
                  </div>
                )
              )}

              {step.key === "candidate_matching" && (
                statuses.candidate_matching === "running" ? (
                  <MarkdownOutput content={outputs.candidate_matching} streaming />
                ) : outputs.candidate_matching ? (
                  <CandidateScoreList
                    candidates={candidates}
                    selected={selectedCandidates}
                    onToggle={(id) =>
                      setSelectedCandidates((prev) => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      })
                    }
                  />
                ) : null
              )}

              {step.key === "email_drafting" && (
                statuses.email_drafting === "running" ? (
                  <MarkdownOutput content={outputs.email_drafting} streaming />
                ) : emailDrafts.length > 0 ? (
                  <EmailPreview emails={emailDrafts} onChange={setEmailDrafts} />
                ) : outputs.email_drafting ? (
                  <MarkdownOutput content={outputs.email_drafting} className="max-h-80 overflow-y-auto" />
                ) : null
              )}

              {step.key === "interview_prep" && outputs.interview_prep && (
                <MarkdownOutput
                  content={outputs.interview_prep}
                  streaming={statuses.interview_prep === "running"}
                  className="max-h-[500px] overflow-y-auto"
                />
              )}
            </StepCard>
          ))}
        </>
      )}

      <RunHistory jobId={selectedJobId || undefined} />
      <Phase2Stubs />
    </div>
  );
}
