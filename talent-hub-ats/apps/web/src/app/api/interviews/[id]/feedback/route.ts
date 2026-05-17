import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { uploadFile } from "@/lib/storage";
import { randomUUID } from "crypto";

const LEGACY_RATINGS = [
  "STRONG_NO",
  "NO",
  "NEUTRAL",
  "YES",
  "STRONG_YES",
] as const;

const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
];
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5 MB

const KEY = "interviewFeedbackOptions";

type CriterionRating = { criterion: string; rating: number | "NA" };

function getFeedbackOptions(settingsJson: string): { value: string; label: string }[] {
  try {
    const s = JSON.parse(settingsJson || "{}") as Record<string, unknown>;
    const raw = s[KEY];
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .filter(
          (o: unknown): o is { value: string; label: string } =>
            typeof o === "object" &&
            o !== null &&
            typeof (o as { value?: string }).value === "string" &&
            typeof (o as { label?: string }).label === "string"
        )
        .map((o) => ({ value: String(o.value).trim(), label: String(o.label).trim() }));
    }
  } catch {
    // ignore
  }
  return [
    { value: "PROCEED", label: "Proceed to next stage" },
    { value: "REJECT", label: "Reject" },
  ];
}

/** Map custom recommendation value to legacy overallRating for storage */
function recommendationToRating(value: string): string {
  const v = value.toUpperCase();
  if (v === "REJECT" || v === "NO") return "NO";
  if (v === "PROCEED" || v === "YES") return "YES";
  return "NEUTRAL";
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/pdf": "pdf",
  };
  return map[mimeType] || "bin";
}

function parseCriterionRatings(raw: unknown): CriterionRating[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is CriterionRating =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as CriterionRating).criterion === "string" &&
      ((r as CriterionRating).rating === "NA" || typeof (r as CriterionRating).rating === "number")
  );
}

async function parseRequest(req: NextRequest): Promise<{
  recommendation?: string;
  overallRating?: string;
  summary?: string;
  sections?: string[];
  technicalRatings?: CriterionRating[];
  culturalRatings?: CriterionRating[];
  attachmentFile?: File;
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const recommendation = formData.get("recommendation") as string | null;
    const summary = formData.get("summary") as string | null;
    const attachment = formData.get("attachment") as File | null;

    let sections: string[] = [];
    let technicalRatings: CriterionRating[] = [];
    let culturalRatings: CriterionRating[] = [];
    try { sections = JSON.parse((formData.get("sections") as string) || "[]"); } catch { sections = []; }
    try { technicalRatings = parseCriterionRatings(JSON.parse((formData.get("technicalRatings") as string) || "[]")); } catch { technicalRatings = []; }
    try { culturalRatings = parseCriterionRatings(JSON.parse((formData.get("culturalRatings") as string) || "[]")); } catch { culturalRatings = []; }

    return {
      recommendation: recommendation || undefined,
      summary: summary || undefined,
      sections,
      technicalRatings,
      culturalRatings,
      attachmentFile: attachment || undefined,
    };
  }

  const body = await req.json();
  return {
    recommendation: body.recommendation,
    overallRating: body.overallRating,
    summary: body.summary,
    sections: Array.isArray(body.sections) ? body.sections : [],
    technicalRatings: parseCriterionRatings(body.technicalRatings),
    culturalRatings: parseCriterionRatings(body.culturalRatings),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  const organizationId = (session.user as { organizationId?: string }).organizationId;
  if (!userId || !organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: interviewId } = await params;
    const {
      overallRating,
      recommendation,
      summary,
      sections = [],
      technicalRatings = [],
      culturalRatings = [],
      attachmentFile,
    } = await parseRequest(req);

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: { include: { job: true } },
        panelists: true,
      },
    });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    if (interview.application.job.organizationId !== organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isPanelist = interview.panelists.some((p) => p.userId === userId);
    if (!isPanelist) {
      return NextResponse.json(
        { error: "Only panelists for this interview can submit feedback" },
        { status: 403 }
      );
    }

    // Check if this panelist already submitted
    const existing = await prisma.scorecard.findFirst({
      where: {
        interviewId,
        reviewerId: userId,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted feedback for this interview" },
        { status: 400 }
      );
    }

    let overallRatingValue: string;
    let recommendationValue: string | null = recommendation?.trim() || null;

    if (recommendationValue) {
      // Use org's feedback options to validate recommendation
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      });
      const options = org ? getFeedbackOptions(org.settings) : getFeedbackOptions("{}");
      const validValues = options.map((o) => o.value);
      if (!validValues.includes(recommendationValue)) {
        return NextResponse.json(
          {
            error: `Invalid recommendation. Must be one of: ${validValues.join(", ")}`,
          },
          { status: 400 }
        );
      }
      overallRatingValue = recommendationToRating(recommendationValue);
    } else if (overallRating) {
      if (!LEGACY_RATINGS.includes(overallRating as (typeof LEGACY_RATINGS)[number])) {
        return NextResponse.json(
          {
            error: `Invalid overallRating. Must be one of: ${LEGACY_RATINGS.join(", ")}`,
          },
          { status: 400 }
        );
      }
      overallRatingValue = overallRating;
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either recommendation (from feedback options) or overallRating (STRONG_NO, NO, NEUTRAL, YES, STRONG_YES)",
        },
        { status: 400 }
      );
    }

    // Compute average score from all non-NA ratings
    const allRated = [...technicalRatings, ...culturalRatings].filter(
      (r) => r.rating !== "NA"
    );
    const averageScore =
      allRated.length > 0
        ? allRated.reduce((sum, r) => sum + Number(r.rating), 0) / allRated.length
        : null;

    const ratingsPayload = {
      sections,
      technical: technicalRatings,
      cultural: culturalRatings,
      averageScore,
    };

    // Handle file upload if present
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (attachmentFile && attachmentFile.size > 0) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(attachmentFile.type)) {
        return NextResponse.json(
          { error: "Attachment must be PNG, JPEG, or PDF" },
          { status: 400 }
        );
      }
      if (attachmentFile.size > MAX_ATTACHMENT_SIZE) {
        return NextResponse.json(
          { error: "Attachment must be under 5 MB" },
          { status: 400 }
        );
      }

      const ext = getExtension(attachmentFile.type);
      const storageKey = `feedback/${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      await uploadFile(buffer, storageKey, attachmentFile.type);
      attachmentUrl = storageKey;
      attachmentName = attachmentFile.name;
    }

    const scorecard = await prisma.scorecard.create({
      data: {
        applicationId: interview.applicationId,
        interviewId,
        reviewerId: userId,
        overallRating: overallRatingValue,
        recommendation: recommendationValue,
        summary: summary?.trim() || null,
        ratings: JSON.stringify(ratingsPayload),
        attachmentUrl,
        attachmentName,
      },
    });

    await prisma.interviewPanelist.updateMany({
      where: { interviewId, userId },
      data: { respondedAt: new Date(), response: recommendationValue },
    });

    return NextResponse.json(
      { ...scorecard, submittedAt: scorecard.submittedAt.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    console.error("Submit feedback error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
