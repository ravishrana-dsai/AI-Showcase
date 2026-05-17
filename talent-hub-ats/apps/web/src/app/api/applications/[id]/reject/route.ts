import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { enqueueEmail } from "@/lib/email";
import { z } from "zod";

const rejectSchema = z.object({
  category: z.enum([
    "NOT_QUALIFIED",
    "POSITION_FILLED",
    "SALARY_MISMATCH",
    "CULTURE_FIT",
    "NO_SHOW",
    "WITHDREW",
    "OTHER",
  ]),
  reason: z.string().max(1000).optional(),
  sendRejectionEmail: z.boolean().default(false),
  templateId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { category, reason, sendRejectionEmail, templateId } = parsed.data;

    const application = await prisma.application.findFirst({
      where: { id },
      include: {
        candidate: { select: { firstName: true, lastName: true, email: true } },
        job: { select: { title: true, organization: { select: { name: true } } } },
        currentStage: { select: { id: true, name: true } },
      },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Verify org access
    const job = await prisma.job.findFirst({
      where: { id: application.jobId, organizationId: session.user.organizationId },
    });
    if (!job) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (application.status === "REJECTED") {
      return NextResponse.json({ error: "Application is already rejected" }, { status: 409 });
    }

    // Reject the application
    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionCategory: category,
        rejectionReason: reason || null,
        rejectedStageId: application.currentStageId,
      },
    });

    // Close out the current stage history entry
    await prisma.stageHistory.updateMany({
      where: { applicationId: id, exitedAt: null },
      data: { exitedAt: new Date(), movedById: session.user.id },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        type: "APPLICATION_REJECTED",
        description: `Application rejected at stage "${application.currentStage.name}" — category: ${category}`,
        metadata: JSON.stringify({ applicationId: id, category, reason }),
        candidateId: application.candidateId,
        actorId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "application.rejected",
        entityType: "Application",
        entityId: id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        metadata: JSON.stringify({ category, reason, stageId: application.currentStageId }),
        organizationId: session.user.organizationId,
      },
    });

    // Send rejection email if requested
    if (sendRejectionEmail) {
      let emailHtml: string;
      let subject = `Update on your application for ${application.job.title}`;

      if (templateId) {
        const template = await prisma.emailTemplate.findFirst({
          where: { id: templateId, organizationId: session.user.organizationId },
        });
        if (template) {
          const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;
          emailHtml = template.body
            .replace(/\{\{candidateName\}\}/g, candidateName)
            .replace(/\{\{jobTitle\}\}/g, application.job.title)
            .replace(/\{\{companyName\}\}/g, application.job.organization.name);
          subject = template.subject
            .replace(/\{\{jobTitle\}\}/g, application.job.title)
            .replace(/\{\{companyName\}\}/g, application.job.organization.name);
        } else {
          emailHtml = buildDefaultRejectionEmail(application);
        }
      } else {
        emailHtml = buildDefaultRejectionEmail(application);
      }

      await enqueueEmail({
        to: application.candidate.email,
        subject,
        html: emailHtml,
      });
    }

    return NextResponse.json({ success: true, application: updated });
  } catch (error) {
    console.error("Reject application error:", error);
    return NextResponse.json({ error: "Failed to reject application" }, { status: 500 });
  }
}

function buildDefaultRejectionEmail(application: {
  candidate: { firstName: string; lastName: string };
  job: { title: string; organization: { name: string } };
}): string {
  const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>Hi ${candidateName},</p>
      <p>Thank you for your interest in the <strong>${application.job.title}</strong> position at
      <strong>${application.job.organization.name}</strong> and for the time you invested in our process.</p>
      <p>After careful consideration, we have decided to move forward with other candidates whose
      experience more closely matches our current needs.</p>
      <p>We appreciate you taking the time to apply and encourage you to apply for future opportunities
      that align with your skills and experience.</p>
      <p>Best regards,<br/>The ${application.job.organization.name} Hiring Team</p>
    </div>
  `;
}
