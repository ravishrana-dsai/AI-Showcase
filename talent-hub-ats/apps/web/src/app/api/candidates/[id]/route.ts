import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";

/**
 * GET /api/candidates/:id
 * Returns candidate for edit form (used by edit page).
 * For full detail view, the dashboard page fetches server-side.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; organizationId: string };
  const { id } = await params;

  const candidate = await prisma.candidate.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      currentCompany: true,
      currentTitle: true,
      location: true,
      linkedinUrl: true,
      portfolioUrl: true,
      source: true,
      sourceDetail: true,
      summary: true,
      expectedCtc: true,
      noticePeriod: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  return NextResponse.json({ candidate });
}

/**
 * PATCH /api/candidates/:id
 * Update candidate details (e.g. after correcting parsed CV data)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; organizationId: string };
  const { id } = await params;

  const candidate = await prisma.candidate.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    // Allow a targeted isArchived-only patch (e.g. unarchive from the UI)
    if (typeof body.isArchived === "boolean" && Object.keys(body).length === 1) {
      const updated = await prisma.candidate.update({
        where: { id },
        data: { isArchived: body.isArchived },
      });
      return NextResponse.json({ candidate: updated });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      currentCompany,
      currentTitle,
      location,
      linkedinUrl,
      portfolioUrl,
      source,
      sourceDetail,
      summary,
      expectedCtc,
      noticePeriod,
    } = body;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    const newEmail = email.toLowerCase().trim();
    if (newEmail !== candidate.email) {
      const existing = await prisma.candidate.findFirst({
        where: {
          email: newEmail,
          organizationId: user.organizationId,
          id: { not: id },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A candidate with this email already exists" },
          { status: 409 }
        );
      }
    }

    let customFields = candidate.customFields;
    if (!newEmail.endsWith("@pending.noreply")) {
      try {
        const cf = JSON.parse(candidate.customFields || "{}") as Record<
          string,
          unknown
        >;
        if (cf.emailPending) {
          delete cf.emailPending;
          customFields = JSON.stringify(cf);
        }
      } catch {
        /* keep existing customFields */
      }
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: newEmail,
        phone: phone?.trim() || null,
        currentCompany: currentCompany?.trim() || null,
        currentTitle: currentTitle?.trim() || null,
        location: location?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
        portfolioUrl: portfolioUrl?.trim() || null,
        source: source?.trim() || null,
        sourceDetail: sourceDetail?.trim() || null,
        summary: summary?.trim() || null,
        expectedCtc: expectedCtc?.trim() || null,
        noticePeriod: noticePeriod?.trim() || null,
        customFields,
      },
    });

    await prisma.activityLog.create({
      data: {
        type: "candidate_updated",
        description: "Candidate details updated",
        candidateId: id,
        actorId: user.id,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({ candidate: updated });
  } catch (error) {
    console.error("Update candidate error:", error);
    return NextResponse.json(
      { error: "Failed to update candidate" },
      { status: 500 }
    );
  }
}
