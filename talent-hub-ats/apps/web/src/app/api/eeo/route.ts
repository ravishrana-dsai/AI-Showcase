import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";

/**
 * POST /api/eeo
 * Submit EEO self-identification data (from candidate-facing form)
 * This data is stored separately and anonymized for reporting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { candidateId, gender, race, ethnicity, veteranStatus, disabilityStatus } = body;

    if (!candidateId) {
      return NextResponse.json(
        { error: "Candidate ID is required" },
        { status: 400 }
      );
    }

    // Upsert EEO response (candidate can update their response)
    const eeoResponse = await prisma.eeoResponse.upsert({
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

    return NextResponse.json({ success: true, eeoResponse });
  } catch (error) {
    console.error("EEO submission error:", error);
    return NextResponse.json(
      { error: "Failed to save EEO data" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/eeo?organizationId=xxx
 * Get anonymized, aggregated EEO data for OFCCP reporting
 * Only accessible by admins
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all EEO responses for the organization (anonymized - no candidate IDs returned)
    const responses = await prisma.eeoResponse.findMany({
      where: {
        candidate: { organizationId: user.organizationId },
      },
      select: {
        gender: true,
        race: true,
        ethnicity: true,
        veteranStatus: true,
        disabilityStatus: true,
      },
    });

    // Aggregate the data
    const aggregate = (field: string) => {
      const counts: Record<string, number> = {};
      let total = 0;
      let declined = 0;

      for (const r of responses) {
        const value = (r as any)[field];
        if (!value || value === "DECLINE_TO_ANSWER") {
          declined++;
        } else {
          counts[value] = (counts[value] || 0) + 1;
          total++;
        }
      }

      return { counts, total, declined, responseRate: responses.length > 0 ? ((total / responses.length) * 100).toFixed(1) : "0" };
    };

    return NextResponse.json({
      success: true,
      totalResponses: responses.length,
      gender: aggregate("gender"),
      race: aggregate("race"),
      ethnicity: aggregate("ethnicity"),
      veteranStatus: aggregate("veteranStatus"),
      disabilityStatus: aggregate("disabilityStatus"),
    });
  } catch (error) {
    console.error("EEO reporting error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
