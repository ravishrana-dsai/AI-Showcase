import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Registration is disabled. Contact your administrator." },
    { status: 403 }
  );
}
