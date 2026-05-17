import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      candidateId,
      gender,
      race,
      ethnicity,
      veteranStatus,
      disabilityStatus,
    } = body;

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidateId is required" },
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

    const eeo = await prisma.eeoResponse.upsert({
      where: { candidateId },
      update: {
        gender: gender || null,
        race: race || null,
        ethnicity: ethnicity || null,
        veteranStatus: veteranStatus || null,
        disabilityStatus: disabilityStatus || null,
        submittedAt: new Date(),
      },
      create: {
        candidateId,
        gender: gender || null,
        race: race || null,
        ethnicity: ethnicity || null,
        veteranStatus: veteranStatus || null,
        disabilityStatus: disabilityStatus || null,
      },
    });

    return NextResponse.json({ success: true, eeo }, { status: 201 });
  } catch (error) {
    console.error("EEO submission error:", error);
    return NextResponse.json(
      { error: "Failed to save EEO response" },
      { status: 500 }
    );
  }
}
