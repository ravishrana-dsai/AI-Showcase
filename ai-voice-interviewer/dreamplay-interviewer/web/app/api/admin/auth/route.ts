import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { pin?: string };
    const ADMIN_PIN = process.env.ADMIN_PIN ?? "ADMIN_PIN_PLACEHOLDER";

    if (body.pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("admin_pin", ADMIN_PIN, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[POST /api/admin/auth]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
