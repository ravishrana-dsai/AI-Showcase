import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN"];

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as { organizationId?: string; role?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.careerPageConfig.findUnique({
    where: { organizationId: user.organizationId },
  });

  // Return config or defaults if not yet created
  return NextResponse.json(config ?? { organizationId: user.organizationId });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as { organizationId?: string; role?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ALLOWED_ROLES.includes(user.role ?? "")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Sanitize custom CSS: strip dangerous patterns
    if (typeof body.customCss === "string") {
      body.customCss = body.customCss
        .replace(/<[^>]*>/g, "")
        .replace(/expression\s*\(/gi, "")
        .replace(/javascript\s*:/gi, "")
        .replace(/@import/gi, "");
    }

    const data: Record<string, unknown> = {};

    const strings = [
      "primaryColor", "accentColor", "backgroundColor",
      "heroHeadline", "heroSubheadline", "heroDescription",
      "logoUrl", "bannerImageUrl", "ogImageUrl",
      "linkedinUrl", "twitterUrl", "githubUrl", "instagramUrl",
      "metaTitle", "metaDescription",
      "customCss", "footerText", "privacyPolicyUrl", "termsUrl",
    ];
    for (const key of strings) {
      if (key in body) {
        data[key] = typeof body[key] === "string" ? body[key].trim() || null : null;
      }
    }
    // Non-nullable strings with defaults
    const nonNullableStrings = ["primaryColor", "accentColor", "backgroundColor",
      "heroHeadline", "heroSubheadline", "heroDescription"];
    for (const key of nonNullableStrings) {
      if (key in data && !data[key]) {
        delete data[key]; // keep existing default
      }
    }

    const booleans = ["showValues", "showBenefits", "showTestimonials", "showStats"];
    for (const key of booleans) {
      if (key in body) data[key] = Boolean(body[key]);
    }

    const jsonFields = ["values", "benefits", "testimonials", "stats"];
    for (const key of jsonFields) {
      if (key in body && Array.isArray(body[key])) {
        data[key] = body[key];
      }
    }

    const config = await prisma.careerPageConfig.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, ...data },
      update: data,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Career page config update error:", error);
    return NextResponse.json({ error: "Failed to update career page config" }, { status: 500 });
  }
}
