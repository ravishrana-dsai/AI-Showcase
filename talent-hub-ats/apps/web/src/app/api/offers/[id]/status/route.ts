import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { fireWebhooks } from "@/lib/webhooks";

const VALID_STATUSES = [
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "VOIDED",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            currentStage: true,
            candidate: true,
            job: { select: { id: true, title: true, createdById: true, hiringManagerId: true, organizationId: true } },
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: "Offer not found" },
        { status: 404 }
      );
    }

    // Allow SENT only when the application is in an Offer pipeline stage
    if (status === "SENT") {
      const stageType = offer.application?.currentStage?.type;
      if (stageType !== "OFFER") {
        return NextResponse.json(
          {
            error:
              "Offer can be marked as SENT only when the application is in an Offer stage. Move the candidate to the Offer stage in the job pipeline first.",
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status };

    switch (status) {
      case "SENT":
        updateData.sentAt = now;
        break;
      case "ACCEPTED":
        updateData.acceptedAt = now;
        break;
      case "DECLINED":
        updateData.declinedAt = now;
        break;
      case "VOIDED":
        updateData.voidedAt = now;
        break;
    }

    const updatedOffer = await prisma.offer.update({
      where: { id },
      data: updateData,
      include: {
        application: { include: { candidate: true, job: true } },
      },
    });

    // If ACCEPTED, update application status to HIRED and set hiredAt
    if (status === "ACCEPTED") {
      await prisma.application.update({
        where: { id: offer.applicationId },
        data: { status: "HIRED", hiredAt: now },
      });
    }

    // Notify job owner and hiring manager for SENT / ACCEPTED / DECLINED
    if (["SENT", "ACCEPTED", "DECLINED"].includes(status)) {
      const app = offer.application;
      const candidateName = app?.candidate
        ? `${app.candidate.firstName} ${app.candidate.lastName}`
        : "Candidate";
      const job = app?.job;
      const toNotify = job
        ? [job.createdById, job.hiringManagerId].filter(
            (id): id is string => !!id && id !== session.user?.id
          )
        : [];
      const uniqueIds = [...new Set(toNotify)];
      const message =
        status === "SENT"
          ? `Offer sent to ${candidateName} for ${job?.title ?? "the role"}.`
          : status === "ACCEPTED"
            ? `${candidateName} accepted the offer for ${job?.title ?? "the role"}.`
            : `${candidateName} declined the offer for ${job?.title ?? "the role"}.`;
      if (uniqueIds.length > 0) {
        await prisma.notification.createMany({
          data: uniqueIds.map((userId) => ({
            userId,
            type: `OFFER_${status}`,
            title: status === "SENT" ? "Offer sent" : status === "ACCEPTED" ? "Offer accepted" : "Offer declined",
            message,
            link: app ? `/dashboard/candidates/${app.candidateId}` : "/dashboard/offers",
          })),
        });
      }
      const orgId = offer.application?.job?.organizationId;
      if (orgId) {
        const event = status === "SENT" ? "offer.sent" : status === "ACCEPTED" ? "offer.accepted" : "offer.declined";
        fireWebhooks(orgId, event as "offer.sent" | "offer.accepted" | "offer.declined", {
          offerId: updatedOffer.id,
          applicationId: offer.applicationId,
          candidateId: app?.candidateId,
          jobId: app?.jobId,
          status,
        }).catch((e) => console.error("Webhook fire error:", e));
      }
    }

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error("Update offer status error:", error);
    return NextResponse.json(
      { error: "Failed to update offer status" },
      { status: 500 }
    );
  }
}
