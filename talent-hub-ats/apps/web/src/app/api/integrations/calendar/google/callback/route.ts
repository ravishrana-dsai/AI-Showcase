import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { google } from "googleapis";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL(`${process.env.BASE_PATH || ""}/login`, req.nextUrl.origin));
  }

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  // Validate OAuth state to prevent CSRF: the connect route sets state = session.user.id
  if (!state || state !== session.user.id) {
    return NextResponse.redirect(
      new URL(`${process.env.BASE_PATH || ""}/dashboard/settings/integrations?error=calendar_invalid_state`, req.nextUrl.origin)
    );
  }

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`${process.env.BASE_PATH || ""}/dashboard/settings/integrations?error=calendar_denied`, req.nextUrl.origin)
    );
  }

  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/integrations/calendar/google/callback`
    );

    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Incomplete token response from Google.");
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await prisma.calendarIntegration.upsert({
      where: { userId: session.user.id },
      create: {
        provider: "GOOGLE",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        isActive: true,
        needsReauth: false,
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        isActive: true,
        needsReauth: false,
      },
    });

    return NextResponse.redirect(
      new URL(`${process.env.BASE_PATH || ""}/dashboard/settings/integrations?success=calendar_connected`, req.nextUrl.origin)
    );
  } catch (err) {
    console.error("[Calendar OAuth] Callback error:", err);
    return NextResponse.redirect(
      new URL(`${process.env.BASE_PATH || ""}/dashboard/settings/integrations?error=calendar_failed`, req.nextUrl.origin)
    );
  }
}
