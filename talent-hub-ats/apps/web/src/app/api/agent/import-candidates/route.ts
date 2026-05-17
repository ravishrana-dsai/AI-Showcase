import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@talent-hub/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isValidLinkedInProfileUrl } from "@/lib/agent/exa";
import { withRateLimit } from "@/lib/with-rate-limit";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "RECRUITER"]);

const CandidateSchema = z.object({
  name: z.string().min(1).max(200),
  linkedinUrl: z.string().url().max(500),
  title: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
});

const RequestSchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(10),
});

async function handler(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole: string = (session.user as Record<string, unknown>).role as string ?? "";
  if (!ALLOWED_ROLES.has(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orgId = session.user.organizationId;
  const results: { name: string; status: "imported" | "duplicate" | "invalid_url" }[] = [];

  for (const raw of body.candidates) {
    // Re-validate LinkedIn URL server-side (defence in depth)
    if (!isValidLinkedInProfileUrl(raw.linkedinUrl)) {
      results.push({ name: raw.name, status: "invalid_url" });
      continue;
    }

    // Deduplication: check if this LinkedIn URL is already in the org
    const existingByLinkedin = await prisma.candidate.findFirst({
      where: { linkedinUrl: raw.linkedinUrl, organizationId: orgId },
      select: { id: true },
    });
    if (existingByLinkedin) {
      results.push({ name: raw.name, status: "duplicate" });
      continue;
    }

    // Split name into first/last
    const parts = raw.name.trim().split(/\s+/);
    const firstName = parts[0] ?? raw.name;
    const lastName = parts.slice(1).join(" ") || "-";

    // Placeholder email — sourced candidates don't have emails yet.
    // Unique per LinkedIn URL slug to avoid conflicts.
    const slug = raw.linkedinUrl.split("/in/")[1]?.replace(/\/$/, "") ?? Date.now().toString();
    const placeholderEmail = `sourced-${slug.slice(0, 40)}@pending.noreply`;

    // Check if placeholder email already used (second guard for re-runs)
    const existingByEmail = await prisma.candidate.findFirst({
      where: { email: placeholderEmail, organizationId: orgId },
      select: { id: true },
    });
    if (existingByEmail) {
      results.push({ name: raw.name, status: "duplicate" });
      continue;
    }

    await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        email: placeholderEmail,
        linkedinUrl: raw.linkedinUrl,
        currentTitle: raw.title ?? null,
        currentCompany: raw.company ?? null,
        summary: raw.summary ? raw.summary.slice(0, 2000) : null,
        source: "LinkedIn Sourcing",
        sourceDetail: "Sourced via Exa AI People Search",
        organizationId: orgId,
      },
    });

    results.push({ name: raw.name, status: "imported" });
  }

  const imported = results.filter((r) => r.status === "imported").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const invalid = results.filter((r) => r.status === "invalid_url").length;

  return NextResponse.json({ imported, duplicates, invalid, results }, { status: 200 });
}

// 30 imports per hour per user
export const POST = withRateLimit(handler, { limit: 30, windowSeconds: 3600 });
