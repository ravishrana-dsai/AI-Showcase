import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { google } from "googleapis";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/calendar/google/callback`
  );

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    prompt: "consent",
    state: session.user.id,
  });

  return NextResponse.redirect(url);
}
