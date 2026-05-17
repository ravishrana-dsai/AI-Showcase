import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { z } from "zod";

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

const ssoSchema = z.object({
  ssoEnabled: z.boolean(),
  googleDomains: z
    .array(z.string().trim().toLowerCase())
    .transform((arr) => arr.filter(Boolean))
    .refine(
      (arr) => arr.every((d) => DOMAIN_RE.test(d)),
      { message: "One or more domains are invalid (e.g. use company.com)" }
    ),
  ssoDefaultRole: z.enum(["RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "ADMIN"]),
});

function isAdmin(role: string) {
  return ["ADMIN", "SUPER_ADMIN"].includes(role);
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { ssoEnabled: true, googleDomain: true, googleDomains: true, ssoDefaultRole: true },
    });

    // Return googleDomains as canonical list, falling back to legacy googleDomain field
    const domains: string[] =
      org?.googleDomains?.length
        ? org.googleDomains
        : org?.googleDomain
          ? [org.googleDomain]
          : [];

    return NextResponse.json({
      ssoEnabled: org?.ssoEnabled ?? false,
      googleDomains: domains,
      ssoDefaultRole: org?.ssoDefaultRole ?? "RECRUITER",
    });
  } catch (err) {
    console.error("[SSO GET] Prisma error:", err);
    return NextResponse.json({ error: "Failed to load SSO settings." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = ssoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { ssoEnabled, googleDomains, ssoDefaultRole } = parsed.data;

  try {
    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ssoEnabled,
        googleDomains,
        // Keep legacy googleDomain in sync with the first domain for backward compat
        googleDomain: googleDomains[0] ?? null,
        ssoDefaultRole,
      },
      select: { ssoEnabled: true, googleDomains: true, ssoDefaultRole: true },
    });

    return NextResponse.json({
      ssoEnabled: updated.ssoEnabled,
      googleDomains: updated.googleDomains,
      ssoDefaultRole: updated.ssoDefaultRole,
    });
  } catch (err) {
    console.error("[SSO PATCH] Prisma error:", err);
    return NextResponse.json(
      { error: "Failed to save SSO settings. Please try again." },
      { status: 500 }
    );
  }
}
