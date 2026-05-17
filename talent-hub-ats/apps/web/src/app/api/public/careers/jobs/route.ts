import { NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

/** Aggregate open jobs for standalone careers app home /jobs listing. */
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      where: publicCareersJobWhere,
      select: {
        id: true,
        title: true,
        employmentType: true,
        location: { select: { name: true } },
        department: { select: { name: true } },
        organization: { select: { name: true, slug: true } },
        publishedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("Public careers jobs list error:", e);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
