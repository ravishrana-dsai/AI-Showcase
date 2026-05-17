import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInterviewCompleteNotification } from "@/lib/slack";
import type { Scorecard, TranscriptEntry } from "@/lib/types";

interface RouteContext {
  params: { id: string };
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const interview = await prisma.interview.findUnique({
      where: { id: params.id },
      include: { candidate: true, role: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (!interview.transcript) {
      return NextResponse.json(
        { error: "No transcript available to score" },
        { status: 422 }
      );
    }

    const pipecatUrl = process.env.PIPECAT_SERVER_URL ?? "http://localhost:8000";

    const transcript = interview.transcript as TranscriptEntry[];
    const res = await fetch(`${pipecatUrl}/sessions/rescore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interview_id: interview.id,
        role: interview.role.slug,
        transcript,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[POST /api/interviews/[id]/rescore] Pipecat error:", body);
      return NextResponse.json({ error: "Scoring failed" }, { status: 502 });
    }

    const { scorecard } = (await res.json()) as { scorecard: Scorecard };

    await prisma.interview.update({
      where: { id: params.id },
      data: { scorecard: scorecard as never },
    });

    // Re-fire Slack notification with updated scorecard
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendInterviewCompleteNotification({
      interviewId: interview.id,
      candidateName: interview.candidate.name,
      roleName: interview.role.name,
      scorecard,
      adminUrl: appUrl,
    }).catch((err) =>
      console.error("[POST /api/interviews/[id]/rescore] Slack error:", err)
    );

    return NextResponse.json({ scorecard });
  } catch (err) {
    console.error("[POST /api/interviews/[id]/rescore]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
