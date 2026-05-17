import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

interface RouteParams {
  params: Promise<{ slug: string; jobId: string }>;
}

/** Published job detail + org branding + screening questions (apply flow). */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug, jobId } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        careerPageConfig: { select: { logoUrl: true, primaryColor: true } },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: org.id,
        ...publicCareersJobWhere,
      },
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
        organization: { select: { id: true, name: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const screeningQuestions = await prisma.screeningQuestion.findMany({
      where: { jobId, showToCandidate: true },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ organization: org, job, screeningQuestions });
  } catch (e) {
    console.error("Public careers job detail error:", e);
    return NextResponse.json({ error: "Failed to load job" }, { status: 500 });
  }
}
