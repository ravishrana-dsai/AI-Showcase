import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
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

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.candidate.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        organizationId: session.user.organizationId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A candidate with this email already exists", candidateId: existing.id },
        { status: 409 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
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
        organizationId: session.user.organizationId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "CANDIDATE_CREATED",
        description: `Candidate ${firstName} ${lastName} was added manually`,
        candidateId: candidate.id,
        actorId: session.user.id,
        organizationId: (session.user as any).organizationId,
      },
    });

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error("Create candidate error:", error);
    return NextResponse.json(
      { error: "Failed to create candidate" },
      { status: 500 }
    );
  }
}
