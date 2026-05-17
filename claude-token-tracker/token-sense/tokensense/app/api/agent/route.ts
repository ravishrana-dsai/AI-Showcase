import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAgentContext } from "@/lib/db";

function buildSystemPrompt(projectId: string, ctx: ReturnType<typeof getAgentContext>): string {
  const featureList = ctx.features
    .slice(0, 8)
    .map((f) => `  - ${f.feature}: $${Number(f.total_cost).toFixed(4)}/day (${f.call_count} calls)`)
    .join("\n");

  const flagList = ctx.flags.length
    ? ctx.flags.map((f) => `  - ${f.feature}: ${f.issue}`).join("\n")
    : "  - No active flags";

  return `You are TokenSense, an AI cost optimization agent for LLM API spend.

PROJECT: ${projectId}
DAILY SPEND: $${ctx.dailySpend} across ${ctx.features.length} features
TOP COST DRIVER: ${ctx.topFeature} at $${ctx.topCost}/day
MODELS IN USE: ${ctx.models.join(", ") || "none yet"}

COST BY FEATURE (last 24h):
${featureList || "  - No data yet"}

FLAGGED ISSUES:
${flagList}

AVAILABLE OPTIMIZATIONS:
  - Prompt caching: saves 60-90% on repeated static prompts
  - Model right-sizing: replace Opus/GPT-4 with Sonnet/Flash for simple tasks
  - Request batching: consolidate analysis calls to reduce per-call overhead
  - Output length control: add max_tokens limits where responses are over-long

Be concise, specific, and technical. Always cite actual numbers from the project data above.
When asked for code, provide copy-paste-ready snippets.
When asked to audit, list the top 3 savings opportunities with estimated dollar impact.`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, project } = await req.json();
    const projectId = project ?? process.env.TOKENSENSE_PROJECT ?? "dream-play";

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
    }

    const ctx = getAgentContext(projectId);
    const systemPrompt = buildSystemPrompt(projectId, ctx);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    });

    // Convert message history to Gemini format.
    // Gemini requires history to start with 'user' — skip any leading assistant messages.
    const allPrior = (messages as { role: string; text: string }[]).slice(0, -1);
    const firstUserIdx = allPrior.findIndex((m) => m.role === "user");
    const history = firstUserIdx === -1
      ? []
      : allPrior.slice(firstUserIdx).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));

    const lastMessage = messages[messages.length - 1]?.text ?? "";

    const chat = model.startChat({ history });

    // Stream the response
    const result = await chat.sendMessageStream(lastMessage);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[agent]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
