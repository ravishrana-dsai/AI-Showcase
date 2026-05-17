import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/** Open job by id (any org) + screening questions — multi-org /jobs apply page. */
export async function GET(_req: Request, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    const job = await prisma.job.findFirst({
      where: { id: jobId, ...publicCareersJobWhere },
      select: {
        id: true,
        title: true,
        employmentType: true,
        experienceLevel: true,
        openingParagraph: true,
        description: true,
        requirements: true,
        location: { select: { name: true } },
        department: { select: { name: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const screeningQuestions = await prisma.screeningQuestion.findMany({
      where: { jobId, showToCandidate: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ job, screeningQuestions });
  } catch (e) {
    console.error("Public careers job by id error:", e);
    return NextResponse.json({ error: "Failed to load job" }, { status: 500 });
  }
}
