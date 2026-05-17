import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { candidateId, content, isPrivate = false, mentions = [] } = body;

    if (!candidateId || !content) {
      return NextResponse.json(
        { error: "candidateId and content are required" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const organizationId = (session.user as { organizationId?: string })
      .organizationId;
    if (!organizationId || candidate.organizationId !== organizationId) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const note = await prisma.note.create({
      data: {
        candidateId,
        content: content.trim(),
        isPrivate: Boolean(isPrivate),
        authorId: session.user.id,
        mentions: JSON.stringify(mentions),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    // Create ActivityLog
    await prisma.activityLog.create({
      data: {
        type: "NOTE_ADDED",
        description: "A note was added to the candidate",
        metadata: JSON.stringify({ noteId: note.id }),
        candidateId,
        actorId: session.user.id,
        organizationId,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Create note error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
