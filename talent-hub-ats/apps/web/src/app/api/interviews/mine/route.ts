import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";

/**
 * GET /api/interviews/mine
 * Returns interviews where the current user is a panelist.
 * Used by the "My Interviews" standalone page for interviewers.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!userId || !organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const hideDemo = await getOrgHideDemoData(organizationId);
    const demoWhere = demoFilterWhere(hideDemo);

    const interviews = await prisma.interview.findMany({
      where: {
        ...demoWhere,
        panelists: { some: { userId } },
        application: {
          job: { organizationId },
        },
      },
      include: {
        application: {
          include: {
            candidate: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            job: { select: { id: true, title: true } },
            currentStage: { select: { name: true } },
          },
        },
        panelists: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        scorecards: {
          select: { id: true, reviewerId: true, overallRating: true, recommendation: true, submittedAt: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    });

    const serialized = interviews.map((i) => ({
      ...i,
      scheduledAt: i.scheduledAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      cancelledAt: i.cancelledAt?.toISOString() ?? null,
      application: {
        ...i.application,
        appliedAt: i.application.appliedAt.toISOString(),
      },
      myScorecard: (() => {
        const sc = i.scorecards.find((s) => s.reviewerId === userId);
        if (!sc) return null;
        return { ...sc, submittedAt: sc.submittedAt.toISOString() };
      })(),
    }));

    return NextResponse.json({ interviews: serialized });
  } catch (error) {
    console.error("Get my interviews error:", error);
    return NextResponse.json(
      { error: "Failed to load interviews" },
      { status: 500 }
    );
  }
}
