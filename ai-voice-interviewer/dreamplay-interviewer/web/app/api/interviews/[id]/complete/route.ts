import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInterviewCompleteNotification } from "@/lib/slack";
import type { Scorecard, TranscriptEntry } from "@/lib/types";

interface RouteContext {
  params: { id: string };
}

interface CompleteBody {
  transcript: TranscriptEntry[];
  scorecard: Scorecard | null;
}

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<CompleteBody>;

    if (!body.transcript) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    const interview = await prisma.interview.findUnique({
      where: { id: params.id },
      include: { candidate: true, role: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const completedAt = new Date();
    const durationSecs = interview.startedAt
      ? Math.round((completedAt.getTime() - interview.startedAt.getTime()) / 1000)
      : null;

    // Always save transcript, scorecard only if present
    await prisma.interview.update({
      where: { id: params.id },
      data: {
        status: "completed",
        completedAt,
        durationSecs,
        transcript: body.transcript as never,
        ...(body.scorecard ? { scorecard: body.scorecard as never } : {}),
      },
    });

    // Send Slack notification if scorecard is available
    if (body.scorecard) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      try {
        await sendInterviewCompleteNotification({
          interviewId: interview.id,
          candidateName: interview.candidate.name,
          roleName: interview.role.name,
          scorecard: body.scorecard,
          adminUrl: appUrl,
        });
      } catch (slackErr) {
        // Slack failure must not block the response
        console.error("[POST /api/interviews/[id]/complete] Slack error:", slackErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/interviews/[id]/complete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
