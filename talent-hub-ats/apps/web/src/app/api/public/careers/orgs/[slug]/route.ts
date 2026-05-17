import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/** Org career landing: branding config + published jobs (for standalone careers app). */
export async function GET(_req: Request, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        careerPageConfig: true,
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const jobs = await prisma.job.findMany({
      where: { organizationId: org.id, ...publicCareersJobWhere },
      select: {
        id: true,
        title: true,
        employmentType: true,
        location: { select: { name: true } },
        department: { select: { name: true } },
        publishedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ organization: org, jobs });
  } catch (e) {
    console.error("Public careers org bundle error:", e);
    return NextResponse.json({ error: "Failed to load career page" }, { status: 500 });
  }
}
