import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@talent-hub/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { routedStream } from "@/lib/agent/router";
import { getSystemPrompt } from "@/lib/agent/prompts";
import { AGENT_TOOL_DEFINITIONS, LINKEDIN_TOOL_DEFINITIONS, COMPANY_INTEL_TOOL_DEFINITIONS, executeAgentTool } from "@/lib/agent/tools";
import type { AgentStep } from "@/lib/agent/provider";
import { withRateLimit } from "@/lib/with-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RequestSchema = z.object({
  jobId: z.string().min(1),
  step: z.enum(["linkedin_sourcing", "company_intel", "jd_polish", "candidate_matching", "email_drafting", "interview_prep"]),
  context: z.string().optional(), // extra user-provided context
});

// Roles allowed to run the agent (HIRING_MANAGER and below cannot)
const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "RECRUITER"]);

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function agentHandler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user;

  // Role guard: only RECRUITER and above can run agent steps
  const userRole: string = (user as Record<string, unknown>).role as string ?? "";
  if (!ALLOWED_ROLES.has(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify job belongs to this org
  const job = await prisma.job.findFirst({
    where: { id: body.jobId, organizationId: user.organizationId },
    select: { id: true, title: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let collectedText = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        const userMessage = body.context
          ? `Job ID: ${body.jobId}\n\nAdditional context from recruiter:\n${body.context}`
          : `Job ID: ${body.jobId}`;

        // Tool sets per step:
        // - linkedin_sourcing: restricted (no get_candidates) to prevent ATS data reaching Exa
        // - company_intel: read-only job context only (Claude reasons from its own knowledge)
        // - all other steps: full tool set
        const tools =
          body.step === "linkedin_sourcing" ? LINKEDIN_TOOL_DEFINITIONS
          : body.step === "company_intel"   ? COMPANY_INTEL_TOOL_DEFINITIONS
          : AGENT_TOOL_DEFINITIONS;

        await routedStream({
          system: getSystemPrompt(body.step as AgentStep),
          userMessage,
          tools,
          onToolCall: async (name, input) => {
            const result = await executeAgentTool(name, input, user.organizationId);
            send({ type: "tool_result", name, summary: summariseTool(name, result) });
            return result;
          },
          onText: (chunk) => {
            collectedText += chunk;
            send({ type: "text", chunk });
          },
        });

        // Persist the run
        await prisma.agentRun.create({
          data: {
            organizationId: user.organizationId,
            jobId: body.jobId,
            userId: user.id,
            step: body.step,
            status: "generated",
            outputText: collectedText,
          },
        });

        send({ type: "done" });
      } catch (err) {
        console.error("[api/agent] error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Agent request failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// 20 agent requests per hour per user
export const POST = withRateLimit(agentHandler, { limit: 20, windowSeconds: 3600 });

function summariseTool(name: string, result: unknown): string {
  switch (name) {
    case "get_job_details":
      return `Loaded job details`;
    case "get_candidates": {
      const count = Array.isArray(result) ? result.length : 0;
      return `Loaded ${count} candidates`;
    }
    case "get_email_template":
      return `Loaded email template`;
    case "get_scorecard_templates": {
      const count = Array.isArray(result) ? result.length : 0;
      return `Loaded ${count} scorecard template(s)`;
    }
    case "search_linkedin_candidates": {
      const count = Array.isArray(result) ? result.length : 0;
      return `Found ${count} LinkedIn profile(s)`;
    }
    default:
      return `Tool executed`;
  }
}
