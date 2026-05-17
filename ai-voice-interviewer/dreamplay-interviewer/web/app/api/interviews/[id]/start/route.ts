import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    if (interview.status === "completed") {
      return NextResponse.json(
        { error: "Interview already completed" },
        { status: 409 }
      );
    }

    // Reconnect: if already in_progress and a Daily room exists, rejoin it
    if (interview.status === "in_progress" && interview.dailyRoomUrl) {
      const pipecatUrl = process.env.PIPECAT_SERVER_URL ?? "http://localhost:8000";
      const tokenRes = await fetch(`${pipecatUrl}/sessions/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interview.id,
          role: interview.role.slug,
          candidate_name: interview.candidate.name,
        }),
      });
      if (tokenRes.ok) {
        const data = (await tokenRes.json()) as { room_url: string; token: string; session_id: string };
        return NextResponse.json({ roomUrl: data.room_url, token: data.token, sessionId: data.session_id, reconnected: true });
      }
      // If Pipecat can't reconnect, fall through to create a fresh session
    }

    const pipecatUrl = process.env.PIPECAT_SERVER_URL ?? "http://localhost:8000";

    const pipecatRes = await fetch(`${pipecatUrl}/sessions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interview_id: interview.id,
        role: interview.role.slug,
        candidate_name: interview.candidate.name,
      }),
    });

    if (!pipecatRes.ok) {
      const errorBody = await pipecatRes.text();
      console.error("[POST /api/interviews/[id]/start] Pipecat error:", errorBody);
      return NextResponse.json(
        { error: "Failed to start interview session" },
        { status: 502 }
      );
    }

    const sessionData = (await pipecatRes.json()) as {
      room_url: string;
      token: string;
      session_id: string;
    };

    await prisma.interview.update({
      where: { id: params.id },
      data: {
        status: "in_progress",
        startedAt: new Date(),
        dailyRoomUrl: sessionData.room_url,
      },
    });

    return NextResponse.json({
      roomUrl: sessionData.room_url,
      token: sessionData.token,
      sessionId: sessionData.session_id,
    });
  } catch (err) {
    console.error("[POST /api/interviews/[id]/start]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
