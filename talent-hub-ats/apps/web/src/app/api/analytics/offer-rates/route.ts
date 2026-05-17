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
  const departmentId = searchParams.get("departmentId");
  const dateFrom = searchParams.get("dateFrom");

  const offers = await prisma.offer.findMany({
    where: {
      application: {
        job: {
          organizationId: session.user.organizationId,
          ...(jobId ? { id: jobId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
      },
      ...(dateFrom
        ? { createdAt: { gte: new Date(dateFrom) } }
        : {}),
    },
    select: {
      status: true,
      createdAt: true,
      application: {
        select: {
          job: {
            select: {
              id: true,
              title: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  let total = 0;
  let accepted = 0;
  let declined = 0;
  let pending = 0;

  const byJob: Record<
    string,
    { title: string; department: string | null; total: number; accepted: number; declined: number; pending: number }
  > = {};

  for (const offer of offers) {
    total++;
    const job = offer.application.job;
    const key = job.id;

    if (!byJob[key]) {
      byJob[key] = {
        title: job.title,
        department: job.department?.name ?? null,
        total: 0,
        accepted: 0,
        declined: 0,
        pending: 0,
      };
    }

    byJob[key].total++;

    if (offer.status === "ACCEPTED") {
      accepted++;
      byJob[key].accepted++;
    } else if (offer.status === "DECLINED") {
      declined++;
      byJob[key].declined++;
    } else {
      pending++;
      byJob[key].pending++;
    }
  }

  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const declineRate = total > 0 ? Math.round((declined / total) * 100) : 0;

  const breakdown = Object.entries(byJob).map(([id, data]) => ({
    jobId: id,
    ...data,
    acceptanceRate: data.total > 0 ? Math.round((data.accepted / data.total) * 100) : 0,
    declineRate: data.total > 0 ? Math.round((data.declined / data.total) * 100) : 0,
  }));

  return NextResponse.json({
    total,
    accepted,
    declined,
    pending,
    acceptanceRate,
    declineRate,
    breakdown,
  });
}
