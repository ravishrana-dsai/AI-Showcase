import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";

interface RouteParams {
  params: Promise<{ candidateId: string }>;
}

/** Minimal candidate payload for public EEO survey (no auth). */
export async function GET(_req: Request, { params }: RouteParams) {
  const { candidateId } = await params;

  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        eeoResponse: { select: { id: true } },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      hasEeoResponse: candidate.eeoResponse != null,
    });
  } catch (e) {
    console.error("Public careers candidate lookup error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
