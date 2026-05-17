import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { fireWebhooks } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      applicationId,
      title,
      salary,
      salaryCurrency = "INR",
      salaryPeriod = "ANNUAL",
      equity,
      bonus,
      startDate,
      expiresAt,
    } = body;

    if (!applicationId || !title || salary == null || salary === undefined) {
      return NextResponse.json(
        { error: "applicationId, title, and salary are required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Check if offer already exists for this application
    const existingOffer = await prisma.offer.findUnique({
      where: { applicationId },
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: "An offer already exists for this application" },
        { status: 400 }
      );
    }

    const offer = await prisma.offer.create({
      data: {
        applicationId,
        title,
        salary: Number(salary),
        salaryCurrency: salaryCurrency || "INR",
        salaryPeriod: salaryPeriod || "ANNUAL",
        equity: equity?.trim() || null,
        bonus: bonus?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        application: { include: { candidate: true, job: true } },
      },
    });

    const orgId = offer.application?.job?.organizationId;
    if (orgId) {
      fireWebhooks(orgId, "offer.created", {
        offerId: offer.id,
        applicationId: offer.applicationId,
        candidateId: offer.application.candidateId,
        jobId: offer.application.jobId,
        title: offer.title,
      }).catch((e) => console.error("Webhook fire error:", e));
    }

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("Create offer error:", error);
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }
}
