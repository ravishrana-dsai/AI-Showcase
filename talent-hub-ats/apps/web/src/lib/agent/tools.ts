import { prisma } from "@talent-hub/db";
import type { ToolDefinition } from "./provider";
import { searchLinkedInCandidates } from "./exa";

// ─── Tool definitions (schemas exposed to Claude) ───────────────────────────

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_job_details",
    description:
      "Retrieve full details of a job posting including title, description, requirements, salary, and scoring criteria.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "get_candidates",
    description:
      "Retrieve all active candidates in the organisation with their profile data, experience, and current applications.",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "The organisation ID" },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "get_email_template",
    description:
      "Retrieve an existing email template by type (e.g. outreach, interview_invite, rejection).",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "string", description: "The organisation ID" },
        type: {
          type: "string",
          description: "Template type keyword: outreach | interview_invite | rejection | offer",
        },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "get_scorecard_templates",
    description:
      "Retrieve existing scorecard criteria for a job's interview rounds, useful as context when generating interview questions.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID" },
      },
      required: ["jobId"],
    },
  },
];

/**
 * Tool definitions for the company_intel step.
 * Only get_job_details is exposed — Claude reasons from its own knowledge
 * after reading the job. No external search calls, no candidate data.
 */
export const COMPANY_INTEL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_job_details",
    description:
      "Retrieve full details of a job posting including title, description, requirements, salary, and scoring criteria.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID" },
      },
      required: ["jobId"],
    },
  },
];

/**
 * Tool definitions for the linkedin_sourcing step only.
 * ONLY get_job_details + search_linkedin_candidates are exposed during this step.
 * get_candidates is intentionally excluded to prevent ATS candidate data
 * from reaching the Exa API.
 */
export const LINKEDIN_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_job_details",
    description:
      "Retrieve full details of a job posting including title, description, requirements, salary, and scoring criteria.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "The job ID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "search_linkedin_candidates",
    description:
      "Search LinkedIn for candidates matching a job. Pass ONLY plain-text job title, skills, and location. Never include database IDs, salary figures, organisation names, or any internal data.",
    inputSchema: {
      type: "object",
      properties: {
        jobTitle: { type: "string", description: "Job title to search for (e.g. 'Senior React Engineer')" },
        skills: { type: "string", description: "Comma-separated key skills (e.g. 'React, TypeScript, Node.js')" },
        location: { type: "string", description: "Location to filter by (e.g. 'Bangalore' or 'Remote')" },
        maxResults: { type: "string", description: "Number of results to fetch, max 10" },
      },
      required: ["jobTitle", "skills", "location"],
    },
  },
];

// ─── Tool implementations ────────────────────────────────────────────────────

export async function executeAgentTool(
  name: string,
  input: unknown,
  organizationId: string
): Promise<unknown> {
  const args = input as Record<string, string>;

  switch (name) {
    case "get_job_details": {
      const job = await prisma.job.findFirst({
        where: { id: args.jobId, organizationId },
        include: {
          department: { select: { name: true } },
          location: { select: { name: true } },
          hiringManager: { select: { name: true, email: true } },
          pipelineStages: { orderBy: { order: "asc" }, select: { name: true, order: true } },
        },
      });
      if (!job) return { error: "Job not found" };
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        scoringCriteria: job.scoringCriteria,
        department: job.department?.name,
        location: job.location?.name,
        hiringManager: job.hiringManager?.name,
        pipelineStages: job.pipelineStages.map((s) => s.name),
      };
    }

    case "get_candidates": {
      const orgId = args.organizationId ?? organizationId;
      const candidates = await prisma.candidate.findMany({
        where: { organizationId: orgId, isArchived: false },
        include: {
          documents: {
            select: { name: true, mimeType: true, parsedText: true },
            orderBy: { uploadedAt: "desc" },
            take: 1,
          },
          applications: {
            select: {
              status: true,
              job: { select: { title: true } },
              currentStage: { select: { name: true } },
            },
            where: { status: "ACTIVE" },
            take: 3,
          },
          tags: { include: { tag: { select: { name: true } } } },
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      });

      return candidates.map((c) => {
        const resumeDoc = c.documents[0];
        // Cap resume text at 2000 chars per candidate to keep context manageable
        const resumeText = resumeDoc?.parsedText
          ? resumeDoc.parsedText.slice(0, 2000)
          : null;
        return {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          currentTitle: c.currentTitle,
          currentCompany: c.currentCompany,
          location: c.location,
          summary: c.summary,
          resumeText,
          activeApplications: c.applications.map((a) => ({
            jobTitle: a.job.title,
            stage: a.currentStage?.name,
          })),
          tags: c.tags.map((t) => t.tag.name),
        };
      });
    }

    case "get_email_template": {
      const orgId = args.organizationId ?? organizationId;
      const template = await prisma.emailTemplate.findFirst({
        where: {
          organizationId: orgId,
          ...(args.type ? { name: { contains: args.type, mode: "insensitive" } } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      if (!template) return { found: false, message: "No matching template found" };
      return {
        id: template.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
      };
    }

    case "get_scorecard_templates": {
      // ScorecardTemplates are linked to InterviewPlanRounds which are linked to InterviewPlans -> Job
      const plans = await prisma.interviewPlan.findMany({
        where: { jobId: args.jobId },
        include: {
          rounds: {
            include: {
              scorecardTemplate: {
                include: { criteria: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        take: 3,
      });

      const result = [];
      for (const plan of plans) {
        for (const round of plan.rounds) {
          if (round.scorecardTemplate) {
            result.push({
              roundName: round.name,
              criteria: round.scorecardTemplate.criteria.map((c) => ({
                name: c.name,
                description: c.description,
                weight: c.weight,
              })),
            });
          }
        }
      }
      return result;
    }

    case "search_linkedin_candidates": {
      // Only plain-text search params are forwarded to Exa — no DB data.
      const { results, locationStrategy } = await searchLinkedInCandidates({
        jobTitle: (args.jobTitle ?? "").slice(0, 200),
        skills: (args.skills ?? "").slice(0, 200),
        location: (args.location ?? "").slice(0, 100),
        maxResults: Math.min(parseInt(args.maxResults ?? "10", 10) || 10, 10),
      });

      // Surface the fallback strategy so Claude can inform the recruiter
      return {
        results,
        locationNote:
          locationStrategy === "exact"
            ? null
            : locationStrategy === "keyword"
            ? "Location filter was broadened (phrase match returned no results). These profiles may not all be based in the specified location."
            : "No location-filtered results found. Showing global profiles instead — location could not be applied.",
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
