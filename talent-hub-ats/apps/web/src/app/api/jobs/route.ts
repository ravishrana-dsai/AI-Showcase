import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const DEFAULT_STAGES = [
  { name: "New", order: 0, type: "NEW" },
  { name: "Screen", order: 1, type: "SCREEN" },
  { name: "Interview", order: 2, type: "INTERVIEW" },
  { name: "Offer", order: 3, type: "OFFER" },
  { name: "Hired", order: 4, type: "HIRED" },
];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  const userId = (session.user as { id?: string }).id;
  const userRole = (session.user as { role?: string }).role;
  if (!organizationId || !userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (description.length < 10) return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });

    let baseSlug = slugify(title) || "job";
    let slug = baseSlug;
    let exists = await prisma.job.findFirst({ where: { organizationId, slug } });
    let n = 0;
    while (exists) {
      n += 1;
      slug = `${baseSlug}-${n}`;
      exists = await prisma.job.findFirst({ where: { organizationId, slug } });
    }

    // Use pipeline template stages if a template was selected
    let stagesToCreate = DEFAULT_STAGES;
    if (body.pipelineTemplateId) {
      const tmpl = await prisma.pipelineTemplate.findFirst({
        where: { id: body.pipelineTemplateId, organizationId },
        include: { stages: { orderBy: { order: "asc" } } },
      });
      if (tmpl && tmpl.stages.length > 0) {
        stagesToCreate = tmpl.stages.map((s, idx) => ({
          name: s.name,
          order: idx,
          type: s.type,
        }));
      }
    }

    const job = await prisma.job.create({
      data: {
        title,
        slug,
        description,
        openingParagraph: body.openingParagraph?.trim() || null,
        requirements: body.requirements?.trim() || null,
        benefits: body.benefits?.trim() || null,
        status: "DRAFT",
        employmentType: body.employmentType ?? "FULL_TIME",
        experienceLevel: body.experienceLevel ?? null,
        departmentId: body.departmentId || null,
        locationId: body.locationId || null,
        hiringManagerId: body.hiringManagerId || null,
        createdById: userId,
        organizationId,
        salaryMin: body.salaryMin != null ? Number(body.salaryMin) : null,
        salaryMax: body.salaryMax != null ? Number(body.salaryMax) : null,
        salaryCurrency: body.salaryCurrency ?? "INR",
        showSalary: Boolean(body.showSalary),
        scoringCriteria: body.scoringCriteria ?? "[]",
        pipelineStages: {
          create: stagesToCreate,
        },
      },
      include: {
        pipelineStages: { orderBy: { order: "asc" } },
      },
    });

    // Auto-assign to the creator if they are a SUB_RECRUITER
    if (userRole === "SUB_RECRUITER") {
      await prisma.userJobAssignment.create({
        data: { userId: userId!, jobId: job.id, assignedById: userId },
      });
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Create job error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
