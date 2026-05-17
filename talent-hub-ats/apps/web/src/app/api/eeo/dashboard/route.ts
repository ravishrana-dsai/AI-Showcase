import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

function countByField(records: Record<string, string | null>[], field: string) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const val = (record[field] as string | null) || "Prefer not to say";
    counts[val] = (counts[val] || 0) + 1;
  }
  const total = records.length;
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("jobId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const responses = await prisma.eeoResponse.findMany({
    where: {
      candidate: { organizationId: session.user.organizationId },
      ...(jobId ? { jobId } : {}),
      ...((dateFrom || dateTo)
        ? {
            submittedAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    select: {
      gender: true,
      race: true,
      ethnicity: true,
      veteranStatus: true,
      disabilityStatus: true,
    },
  });

  const totalCandidates = await prisma.candidate.count({
    where: { organizationId: session.user.organizationId },
  });

  return NextResponse.json({
    totalResponses: responses.length,
    totalCandidates,
    responseRate:
      totalCandidates > 0 ? Math.round((responses.length / totalCandidates) * 100) : 0,
    gender: countByField(responses as Record<string, string | null>[], "gender"),
    race: countByField(responses as Record<string, string | null>[], "race"),
    ethnicity: countByField(responses as Record<string, string | null>[], "ethnicity"),
    veteranStatus: countByField(responses as Record<string, string | null>[], "veteranStatus"),
    disabilityStatus: countByField(responses as Record<string, string | null>[], "disabilityStatus"),
  });
}
