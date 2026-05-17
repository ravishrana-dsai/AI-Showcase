import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("jobId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Fetch stage history with stage order for the org's jobs
  const stageHistoryRecords = await prisma.stageHistory.findMany({
    where: {
      application: {
        job: {
          organizationId: session.user.organizationId,
          ...(jobId ? { id: jobId } : {}),
        },
        ...(dateFrom || dateTo
          ? {
              appliedAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
    },
    select: {
      applicationId: true,
      stageId: true,
      stage: { select: { name: true, order: true, type: true } },
    },
    orderBy: { enteredAt: "asc" },
  });

  // Group by stage, count unique applications that entered each stage
  const stageMap: Record<string, { name: string; order: number; type: string; applications: Set<string> }> = {};

  for (const record of stageHistoryRecords) {
    const key = record.stageId;
    if (!stageMap[key]) {
      stageMap[key] = {
        name: record.stage.name,
        order: record.stage.order,
        type: record.stage.type,
        applications: new Set(),
      };
    }
    stageMap[key].applications.add(record.applicationId);
  }

  // Convert to sorted array with conversion rates — field names match the chart component
  const stages = Object.entries(stageMap)
    .map(([stageId, data]) => ({
      stageId,
      stageName: data.name,
      stageOrder: data.order,
      type: data.type,
      count: data.applications.size,
    }))
    .sort((a, b) => a.stageOrder - b.stageOrder);

  // Add drop-off rates between consecutive stages
  const funnelStages = stages.map((stage, index) => {
    const prevCount = index > 0 ? stages[index - 1].count : stage.count;
    const conversionRate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 100;
    const dropOffRate = 100 - conversionRate;
    return { ...stage, conversionRate, dropOffRate };
  });

  return NextResponse.json({ stages: funnelStages, totalApplications: stages[0]?.count ?? 0 });
}
