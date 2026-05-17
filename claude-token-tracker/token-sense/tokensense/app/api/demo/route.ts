import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { computeCost, detectFlags } from "@/lib/pricing";
import { insertCalls } from "@/lib/db";

const PROJECT_ID = process.env.TOKENSENSE_PROJECT ?? "dream-play";

// ─── Scenario definitions ────────────────────────────────────────────────────

interface Scenario {
  feature: string;
  model: string;
  prompt: string;
  unitId?: string;
  experimentId?: string;
  environment?: string;
}

const SCENARIOS: Record<string, Scenario> = {
  game_analysis: {
    feature: "game_analysis",
    model: "gemini-2.0-flash",
    unitId: `match_${Math.floor(1000 + Math.random() * 9000)}`,
    prompt: `You are a cricket analyst. Analyse this IPL match summary and give 3 key insights:
Match: RCB vs MI | Venue: Wankhede Stadium
RCB innings: 187/4 in 20 overs. Top scorer: Kohli 72(48). de Villiers 45(28).
MI bowling: Bumrah 4-0-28-2, Malinga 4-0-38-1, Krunal 4-0-42-0.
Keep response under 150 words. Be specific with numbers.`,
  },

  coaching_insights: {
    feature: "coaching_insights",
    model: "gemini-2.0-flash",
    unitId: `player_${Math.floor(100 + Math.random() * 900)}`,
    prompt: `You are a cricket performance coach. Generate 3 actionable coaching insights for:
Player: Right-handed batsman, last 10 innings avg: 34.2
Shot efficiency: 45% off-side, 38% on-side, 17% straight
Weakness: Struggles against short-pitched deliveries (dismissed 4 of last 6 times)
Against spin: SR of 112, against pace: SR of 148
Keep each insight to 2 sentences. Focus on drills and measurable targets.`,
  },

  match_prediction: {
    feature: "match_prediction",
    model: "gemini-2.0-flash",
    unitId: `match_${Math.floor(1000 + Math.random() * 9000)}`,
    prompt: `You are a cricket prediction model. Predict the likely winner with confidence score:
Current situation: T20 match, innings 2
Target: 186. Current score: 98/3 after 12 overs. Need 88 from 48 balls.
Batsmen at crease: Dhoni (22* off 18), Jadeja (14* off 10)
Recent form: Last 3 overs scored 28 runs, lost 1 wicket.
Give: winner prediction, confidence %, key factor in 3 sentences max.`,
  },

  commentary_gen: {
    feature: "commentary_gen",
    model: "gemini-2.0-flash",
    prompt: `You are a live cricket commentator. Generate exciting ball-by-ball commentary for these 6 deliveries:
Over 19.1: Kohli faces Bumrah. Short ball outside off. Pulls for SIX!
Over 19.2: Yorker. Digs out. Single.
Over 19.3: ABD on strike. Full toss. Smashed straight for FOUR!
Over 19.4: Slower ball. Mistimed. Out! Caught at mid-off. ABD 45(28).
Over 19.5: New batsman Stoinis. Full delivery. Driven for TWO.
Over 19.6: Wide yorker. Four wides. End of over: 18 runs.
Write like a real broadcaster. Keep energy high.`,
  },

  // Experiment: same task, two different prompt styles — shows real cost difference
  experiment_v1: {
    feature: "game_analysis",
    model: "gemini-2.0-flash",
    experimentId: "prompt_brief_vs_detailed",
    environment: "experiment",
    prompt: `Summarise IPL match: RCB 187/4 vs MI. Kohli 72. MI won by 8 runs. Key player?`,
  },

  experiment_v2: {
    feature: "game_analysis",
    model: "gemini-2.0-flash",
    experimentId: "prompt_brief_vs_detailed",
    environment: "experiment",
    prompt: `You are an expert cricket analyst writing for a sports analytics platform.
Given the following match data, provide a structured analysis:

Match: IPL 2024 | RCB vs MI | Wankhede Stadium
Result: MI won by 8 runs
RCB: 187/4 (20 overs) — Kohli: 72(48), de Villiers: 45(28)
MI chase: 189/3 (19.4 overs) — Rohit: 68(42), Hardik: 51*(31)

Please provide:
1. Match-turning moment (1 sentence)
2. Player of the match justification (2 sentences)
3. One tactical observation for each team (1 sentence each)

Be precise and analytical.`,
  },
};

// ─── Route handler ───────────────────────────────────────────────────────────

export interface DemoResult {
  scenario: string;
  feature: string;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  latencyMs: number;
  flags: string[];
  experimentId?: string;
  environment?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json();

    const s = SCENARIOS[scenario];
    if (!s) {
      return NextResponse.json({ error: `Unknown scenario: ${scenario}` }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: s.model });

    const start = Date.now();
    const result = await geminiModel.generateContent(s.prompt);
    const latencyMs = Date.now() - start;

    const response = result.response;
    const text        = response.text();
    const inputTokens  = response.usageMetadata?.promptTokenCount     ?? 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
    const costUSD = computeCost(s.model, inputTokens, outputTokens);
    const flags   = detectFlags(s.model, inputTokens, false, false, s.feature);

    // Write directly to db (same process — no HTTP hop needed)
    insertCalls([{
      projectId:   PROJECT_ID,
      provider:    "gemini",
      model:       s.model,
      feature:     s.feature,
      unitId:      s.unitId ?? "",
      inputTokens,
      outputTokens,
      costUSD,
      latencyMs,
      flags,
      timestamp:   new Date().toISOString(),
    }]);

    const out: DemoResult = {
      scenario,
      feature:      s.feature,
      model:        s.model,
      text,
      inputTokens,
      outputTokens,
      costUSD,
      latencyMs,
      flags,
      ...(s.experimentId && { experimentId: s.experimentId }),
      ...(s.environment  && { environment:  s.environment  }),
    };

    return NextResponse.json(out);
  } catch (err) {
    console.error("[demo]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
