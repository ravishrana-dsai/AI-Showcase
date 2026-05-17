import { NextRequest, NextResponse } from "next/server";
import { insertCalls, TSCall, EnrichedCall } from "@/lib/db";
import { computeCost, detectFlags } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const calls: TSCall[] = body.calls;

    if (!Array.isArray(calls) || calls.length === 0) {
      return NextResponse.json({ error: "calls array required" }, { status: 400 });
    }

    const enriched: EnrichedCall[] = calls.map((c) => ({
      ...c,
      costUSD: c.costUSD ?? computeCost(c.model, c.inputTokens, c.outputTokens),
      flags: c.flags ?? detectFlags(
        c.model,
        c.inputTokens,
        false,
        false,
        c.feature ?? ""
      ),
    }));

    insertCalls(enriched);

    return NextResponse.json({ accepted: enriched.length });
  } catch (err) {
    console.error("[ingest]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
