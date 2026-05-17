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
  const dateTo = searchParams.get("dateTo");

  const hiredAtFilter = dateFrom || dateTo
    ? {
        not: null,
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    : { not: null };

  const where = {
    status: "HIRED",
    hiredAt: hiredAtFilter,
    job: {
      organizationId: session.user.organizationId,
      ...(jobId ? { id: jobId } : {}),
      ...(departmentId ? { departmentId } : {}),
    },
  };

  const hiredApplications = await prisma.application.findMany({
    where,
    select: {
      id: true,
      appliedAt: true,
      hiredAt: true,
      job: { select: { id: true, title: true, departmentId: true, department: { select: { name: true } } } },
    },
    orderBy: { hiredAt: "desc" },
  });

  const withDays = hiredApplications
    .filter((a) => a.hiredAt)
    .map((a) => ({
      ...a,
      daysToHire: Math.round(
        (new Date(a.hiredAt!).getTime() - new Date(a.appliedAt).getTime()) / 86400000
      ),
    }));

  const days = withDays.map((a) => a.daysToHire).sort((a, b) => a - b);
  const avg = days.length > 0 ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0;
  const median = days.length > 0 ? days[Math.floor(days.length / 2)] : 0;

  // Group by job for breakdown — field names match the TimeToHireChart component
  const byJobMap: Record<string, { jobId: string; jobTitle: string; count: number; avg: number }> = {};
  for (const a of withDays) {
    const key = a.job.id;
    if (!byJobMap[key]) byJobMap[key] = { jobId: a.job.id, jobTitle: a.job.title, count: 0, avg: 0 };
    byJobMap[key].count++;
    byJobMap[key].avg = Math.round(
      (byJobMap[key].avg * (byJobMap[key].count - 1) + a.daysToHire) / byJobMap[key].count
    );
  }

  return NextResponse.json({
    total: days.length,
    avg: days.length > 0 ? avg : null,
    median: days.length > 0 ? median : null,
    min: days.length > 0 ? (days[0] ?? null) : null,
    max: days.length > 0 ? (days[days.length - 1] ?? null) : null,
    byJob: Object.values(byJobMap).sort((a, b) => b.count - a.count),
  });
}
