import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const job = await prisma.job.findFirst({
      where: { id, organizationId },
      include: {
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        hiringManager: { select: { id: true, name: true, email: true } },
        pipelineStages: { orderBy: { order: "asc" } },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    console.error("Get job error:", error);
    return NextResponse.json({ error: "Failed to load job" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userRole = (session.user as { role?: string }).role ?? "";
  if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.job.findFirst({ where: { id, organizationId } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete job error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.job.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : existing.title;
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : existing.description;
    if (description.length < 10) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters" },
        { status: 400 }
      );
    }

    let slug = existing.slug;
    if (title !== existing.title) {
      let baseSlug = slugify(title) || "job";
      slug = baseSlug;
      let exists = await prisma.job.findFirst({
        where: { organizationId, slug, id: { not: id } },
      });
      let n = 0;
      while (exists) {
        n += 1;
        slug = `${baseSlug}-${n}`;
        exists = await prisma.job.findFirst({
          where: { organizationId, slug, id: { not: id } },
        });
      }
    }

    const updateData: Record<string, unknown> = {
        title,
        slug,
        description,
        openingParagraph:
          body.openingParagraph !== undefined
            ? (body.openingParagraph?.trim() || null)
            : undefined,
        requirements:
          body.requirements !== undefined
            ? (body.requirements?.trim() || null)
            : undefined,
        benefits:
          body.benefits !== undefined
            ? (body.benefits?.trim() || null)
            : undefined,
        employmentType: body.employmentType ?? undefined,
        experienceLevel: body.experienceLevel ?? undefined,
        departmentId: body.departmentId ?? undefined,
        locationId: body.locationId ?? undefined,
        hiringManagerId: body.hiringManagerId ?? undefined,
        salaryMin: body.salaryMin != null ? Number(body.salaryMin) : undefined,
        salaryMax: body.salaryMax != null ? Number(body.salaryMax) : undefined,
        salaryCurrency: body.salaryCurrency ?? undefined,
        showSalary: body.showSalary !== undefined ? Boolean(body.showSalary) : undefined,
        scoringCriteria: body.scoringCriteria !== undefined ? body.scoringCriteria : undefined,
      };
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase();
      if (["DRAFT", "PENDING_APPROVAL", "OPEN", "CLOSED", "ON_HOLD", "ARCHIVED"].includes(s)) {
        updateData.status = s;
        if (s === "OPEN") updateData.publishedAt = new Date();
        else if (s === "DRAFT") updateData.publishedAt = null;
      }
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData as any,
      include: {
        department: { select: { name: true } },
        location: { select: { name: true } },
        hiringManager: { select: { name: true, email: true } },
        pipelineStages: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("Update job error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}
