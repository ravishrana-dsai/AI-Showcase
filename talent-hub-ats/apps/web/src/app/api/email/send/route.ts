import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { enqueueEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { to, subject, body: emailBody, templateId, candidateId } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    const fromEmail =
      process.env.EMAIL_FROM ||
      session.user.email ||
      "noreply@talent-hub.com";

    const toTrimmed = String(to).trim();
    const subjectTrimmed = String(subject).trim();

    // Log as "queued" — the worker will update status on delivery
    await prisma.emailLog.create({
      data: {
        to: toTrimmed,
        from: fromEmail,
        subject: subjectTrimmed,
        body: String(emailBody),
        templateId: templateId?.trim() || null,
        candidateId: candidateId?.trim() || null,
        status: "queued",
      },
    });

    await enqueueEmail({
      to: toTrimmed,
      subject: subjectTrimmed,
      html: String(emailBody),
      from: fromEmail,
    });

    return NextResponse.json({ success: true, queued: true }, { status: 202 });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
