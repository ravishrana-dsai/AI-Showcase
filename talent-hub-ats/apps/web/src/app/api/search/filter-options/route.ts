import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;

  const [sourcesRaw, jobs, stagesRaw, tags] = await Promise.all([
    // Distinct candidate sources
    prisma.candidate.findMany({
      where: { organizationId: orgId, isArchived: false, source: { not: null } },
      select: { source: true },
      distinct: ["source"],
      orderBy: { source: "asc" },
    }),
    // All active jobs
    prisma.job.findMany({
      where: { organizationId: orgId, status: { in: ["DRAFT", "OPEN", "CLOSED", "ON_HOLD"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    // Distinct pipeline stage names from applications
    prisma.pipelineStage.findMany({
      where: { job: { organizationId: orgId } },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    }),
    // All org tags
    prisma.tag.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const sources = sourcesRaw.map((r) => r.source).filter(Boolean) as string[];
  const stages = stagesRaw.map((r) => r.name);

  return NextResponse.json({ sources, jobs, stages, tags });
}
