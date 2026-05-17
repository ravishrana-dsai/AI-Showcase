import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

/** Public list of open jobs (no auth). Used by career site. */
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: publicCareersJobWhere,
      select: {
        id: true,
        title: true,
        slug: true,
        employmentType: true,
        experienceLevel: true,
        location: { select: { name: true } },
        organization: { select: { name: true } },
        publishedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("Public jobs error:", e);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
