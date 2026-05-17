import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { importLinkedInProfile } from "@/lib/linkedin/linkedin-import";
import { withRateLimit } from "@/lib/with-rate-limit";

const LINKEDIN_URL_PATTERN = /linkedin\.com\/in\//i;

async function handler(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { linkedinUrl } = body;

  if (!linkedinUrl || typeof linkedinUrl !== "string") {
    return NextResponse.json({ error: "linkedinUrl is required" }, { status: 400 });
  }

  if (!LINKEDIN_URL_PATTERN.test(linkedinUrl)) {
    return NextResponse.json(
      { error: "URL must be a LinkedIn profile URL (linkedin.com/in/...)" },
      { status: 400 }
    );
  }

  try {
    const profile = await importLinkedInProfile(linkedinUrl.trim());
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("[LinkedIn Import] Error:", err);
    return NextResponse.json(
      { error: "Failed to import LinkedIn profile. Please try again or enter details manually." },
      { status: 502 }
    );
  }
}

// Strict rate limit: 10 requests per hour per user
export const POST = withRateLimit(handler, { limit: 10, windowSeconds: 3600 });
