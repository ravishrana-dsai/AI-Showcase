import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInterviewLinkEmail } from "@/lib/email";

interface CreateInterviewBody {
  candidateEmail: string;
  candidateName: string;
  roleSlug: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<CreateInterviewBody>;

    if (!body.candidateEmail || !body.candidateName || !body.roleSlug) {
      return NextResponse.json(
        { error: "candidateEmail, candidateName, and roleSlug are required" },
        { status: 400 }
      );
    }

    const role = await prisma.role.findUnique({
      where: { slug: body.roleSlug },
    });

    if (!role) {
      return NextResponse.json(
        { error: `Role '${body.roleSlug}' not found` },
        { status: 404 }
      );
    }

    const candidate = await prisma.candidate.upsert({
      where: { email: body.candidateEmail } as never,
      update: { name: body.candidateName },
      create: {
        name: body.candidateName,
        email: body.candidateEmail,
      },
    });

    const interview = await prisma.interview.create({
      data: {
        candidateId: candidate.id,
        roleId: role.id,
        status: "pending",
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const interviewLink = `${appUrl}/interview/${interview.token}`;

    // Send email in background — don't block the response if it fails
    sendInterviewLinkEmail({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      roleName: role.name,
      interviewLink,
    }).catch((err) =>
      console.error("[POST /api/interviews/create] Email error:", err)
    );

    return NextResponse.json(
      {
        interviewId: interview.id,
        token: interview.token,
        link: interviewLink,
        candidateName: candidate.name,
        roleSlug: role.slug,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/interviews/create]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
