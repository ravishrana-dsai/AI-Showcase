import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const orgId = session.user.organizationId;

  // Advanced mode params
  const source = searchParams.get("source")?.trim() ?? "";
  const jobId = searchParams.get("jobId")?.trim() ?? "";
  const experienceLevel = searchParams.get("experienceLevel")?.trim() ?? "";
  const stage = searchParams.get("stage")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const tagsParam = searchParams.get("tags")?.trim() ?? "";
  const addedAfter = searchParams.get("addedAfter")?.trim() ?? "";
  const addedBefore = searchParams.get("addedBefore")?.trim() ?? "";
  const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

  const isAdvanced = source || jobId || experienceLevel || stage || status || tagIds.length > 0 || addedAfter || addedBefore;

  if (isAdvanced) {
    // Build candidate where clause with all filters
    const candidateWhere: Record<string, unknown> = {
      organizationId: orgId,
      isArchived: false,
    };

    if (q.length >= 2) {
      candidateWhere.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { currentTitle: { contains: q, mode: "insensitive" } },
        { currentCompany: { contains: q, mode: "insensitive" } },
      ];
    }

    if (source) {
      candidateWhere.source = source;
    }

    if (addedAfter) {
      candidateWhere.createdAt = {
        ...(candidateWhere.createdAt as object ?? {}),
        gte: new Date(addedAfter),
      };
    }

    if (addedBefore) {
      candidateWhere.createdAt = {
        ...(candidateWhere.createdAt as object ?? {}),
        lte: new Date(addedBefore + "T23:59:59"),
      };
    }

    if (tagIds.length > 0) {
      candidateWhere.tags = {
        some: { tagId: { in: tagIds } },
      };
    }

    // Application-level filters require a subquery on applications
    const appFilter: Record<string, unknown> = {};
    if (jobId) appFilter.jobId = jobId;
    if (status) appFilter.status = status;
    if (stage) appFilter.currentStage = { name: stage };
    if (experienceLevel) appFilter.job = { experienceLevel };

    if (Object.keys(appFilter).length > 0) {
      candidateWhere.applications = { some: appFilter };
    }

    const candidates = await prisma.candidate.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: candidateWhere as any,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
        source: true,
        createdAt: true,
        applications: {
          select: {
            id: true,
            status: true,
            job: { select: { id: true, title: true, experienceLevel: true } },
            currentStage: { select: { name: true } },
          },
          orderBy: { appliedAt: "desc" },
          take: 3,
        },
        tags: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ candidates, jobs: [] });
  }

  // Simple mode (existing behaviour)
  if (q.length < 2) {
    return NextResponse.json({ candidates: [], jobs: [] });
  }

  const [candidates, jobs] = await Promise.all([
    prisma.candidate.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { currentTitle: { contains: q, mode: "insensitive" } },
          { currentCompany: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.job.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["DRAFT", "OPEN", "PAUSED"] },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        department: { select: { name: true } },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ candidates, jobs });
}
