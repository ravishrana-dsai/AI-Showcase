import { NextRequest, NextResponse } from "next/server";
import { getProjectStats } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") ?? process.env.TOKENSENSE_PROJECT ?? "dream-play";
    const range = searchParams.get("range") ?? "24h";

    const stats = getProjectStats(project, range);

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[calls]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
