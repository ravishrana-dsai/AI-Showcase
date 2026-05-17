import { NextRequest, NextResponse } from "next/server";
import { insertCalls, TSCall, EnrichedCall } from "@/lib/db";
import { computeCost, detectFlags } from "@/lib/pricing";

const FEATURES = [
  "game_analysis",
  "coaching_insights",
  "match_prediction",
  "player_stats",
  "commentary_gen",
];

const MODELS: { provider: TSCall["provider"]; model: string }[] = [
  { provider: "gemini",    model: "gemini-2.0-flash"           },
  { provider: "gemini",    model: "gemini-1.5-pro"             },
  { provider: "anthropic", model: "claude-sonnet-4-20250514"   },
  { provider: "anthropic", model: "claude-haiku-4"             },
  { provider: "openai",    model: "gpt-4o-mini"                },
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project") ?? "dream-play-seed";
    const count = parseInt(searchParams.get("count") ?? "200");

    const calls: EnrichedCall[] = [];

    // Spread calls across last 48 hours for realistic charts
    for (let i = 0; i < count; i++) {
      const featureIdx = Math.floor(Math.random() * FEATURES.length);
      const feature = FEATURES[featureIdx];
      const { provider, model } = MODELS[Math.floor(Math.random() * MODELS.length)];

      // game_analysis and match_prediction tend to be heavier
      const isHeavy = feature === "game_analysis" || feature === "match_prediction";
      const inputTokens  = isHeavy ? rand(800, 3500) : rand(150, 800);
      const outputTokens = isHeavy ? rand(200, 800)  : rand(50, 300);
      const latencyMs    = isHeavy ? rand(800, 3000)  : rand(200, 1000);

      const matchId = `match_${rand(1000, 9999)}`;
      const hoursBack = randFloat(0, 47);
      const cacheHit = Math.random() > 0.7;

      const flags = detectFlags(model, inputTokens, cacheHit, false, feature);
      const costUSD = computeCost(model, inputTokens, outputTokens);

      calls.push({
        projectId: project,
        feature,
        provider,
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        costUSD,
        flags,
        unitId: matchId,
        timestamp: hoursAgo(hoursBack),
      });
    }

    insertCalls(calls);

    const totalCost = calls.reduce((s, c) => s + c.costUSD, 0);
    return NextResponse.json({
      seeded: calls.length,
      project,
      totalCostUSD: totalCost.toFixed(4),
    });
  } catch (err) {
    console.error("[seed]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
