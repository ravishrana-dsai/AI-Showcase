import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

  const runs = await prisma.agentRun.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(jobId ? { jobId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      step: true,
      status: true,
      createdAt: true,
      jobId: true,
      outputText: true,
      userId: true,
    },
  });

  // Enrich with job titles
  const jobIds = [...new Set(runs.map((r) => r.jobId))];
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, organizationId: session.user.organizationId },
    select: { id: true, title: true },
  });
  const jobMap = Object.fromEntries(jobs.map((j) => [j.id, j.title]));

  return NextResponse.json(
    runs.map((r) => ({
      id: r.id,
      step: r.step,
      status: r.status,
      createdAt: r.createdAt,
      jobId: r.jobId,
      jobTitle: jobMap[r.jobId] ?? "Unknown Job",
      // Only return a snippet in the list view
      outputSnippet: r.outputText.slice(0, 200),
    }))
  );
}
