import { useState } from "react";

const C = {
  bg: "#F7F5F0",
  paper: "#FFFFFF",
  ink: "#1A1814",
  inkMid: "#4A4640",
  inkLight: "#8A8680",
  border: "#E0DDD8",
  borderDark: "#C8C4BE",
  anthropic: "#CC5500",
  anthropicDim: "#CC550015",
  gemini: "#1A73E8",
  geminiDim: "#1A73E815",
  accent: "#2D6A4F",
  accentDim: "#2D6A4F12",
  tag: "#F0EDE8",
  warn: "#B5451B",
};

const PHASES = [
  {
    id: "phase1",
    num: "01",
    title: "Universal SDK",
    subtitle: "The interception layer",
    duration: "Week 1–2",
    color: C.ink,
    steps: [
      {
        title: "Create the npm + pip package scaffold",
        detail: "Init a monorepo: `tokensense-js` (TypeScript) and `tokensense-py` (Python). Both expose an identical surface: `TokenSense.wrap(client, options)`.",
        code: `// tokensense-js/src/index.ts
export class TokenSense {
  static wrap<T extends object>(client: T, opts: WrapOptions): T {
    return new Proxy(client, {
      get(target, prop) {
        const original = target[prop];
        if (prop === "messages" || prop === "chat") {
          return TokenSense._intercept(original, opts);
        }
        return original;
      }
    });
  }
}`,
        tag: "SDK Core",
        tagColor: C.ink,
      },
      {
        title: "Build provider-agnostic interceptor",
        detail: "Detect which provider is being called (Anthropic, OpenAI, Gemini) from the client type. Normalize the request shape into a unified TokenSense schema before forwarding.",
        code: `// Unified schema — identical regardless of provider or environment
interface TSCall {
  provider: "anthropic" | "openai" | "gemini" | "cohere";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;          // computed from pricing table
  latencyMs: number;
  feature?: string;         // e.g. 'coaching_insights'
  unitId?: string;          // e.g. matchId (prod) or run_42 (experiment)
  projectId: string;
  timestamp: string;
  flags: string[];          // e.g. ['static_prompt_not_cached']
  // Dev & ML fields
  environment?: "production" | "development" | "experiment";
  experimentId?: string;    // e.g. 'prompt_v3_vs_v4'
  promptVersion?: string;   // track cost across prompt iterations
}`,
        tag: "Schema",
        tagColor: C.inkMid,
      },
      {
        title: "Build pricing table + auto-updater",
        detail: "Hardcode current pricing for all major models. Add a weekly fetch from a TokenSense-hosted pricing manifest so costs stay accurate as providers update rates.",
        code: `const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic — per 1M tokens
  "claude-opus-4":          { input: 15.00, output: 75.00 },
  "claude-sonnet-4":        { input: 3.00,  output: 15.00 },
  "claude-haiku-4":         { input: 0.80,  output: 4.00  },
  // OpenAI
  "gpt-4o":                 { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":            { input: 0.15,  output: 0.60  },
  // Google Gemini
  "gemini-2.0-flash":       { input: 0.10,  output: 0.40  },
  "gemini-1.5-pro":         { input: 1.25,  output: 5.00  },
  "gemini-1.5-flash":       { input: 0.075, output: 0.30  },
};`,
        tag: "Pricing",
        tagColor: C.accent,
      },
      {
        title: "Async fire-and-forget emitter",
        detail: "After every call, emit telemetry to the TokenSense ingestion API in the background. Use a microtask queue — never await, never block the caller's response path.",
        code: `const telemetryQueue: TSCall[] = [];

// Called after every intercepted LLM response
function emit(payload: TSCall, apiKey: string): void {
  telemetryQueue.push(payload);
  if (telemetryQueue.length >= 50) flushQueue(apiKey);
}

// Runs every 2s via setInterval, and when queue hits 50
async function flushQueue(apiKey: string): Promise<void> {
  if (telemetryQueue.length === 0) return;
  const batch = telemetryQueue.splice(0, 50);
  // Fire and forget — never awaited, never blocks caller
  fetch("https://ingest.tokensense.io/v1/batch", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ calls: batch }),
  }).catch(() => {}); // silent fail — never crash the caller
}`,
        tag: "Reliability",
        tagColor: C.warn,
      },
    ],
  },
  {
    id: "phase2",
    num: "02",
    title: "Ingestion API",
    subtitle: "Receive & store telemetry",
    duration: "Week 2–3",
    color: C.inkMid,
    steps: [
      {
        title: "Build the ingestion endpoint",
        detail: "A simple Node/FastAPI service that receives batched telemetry payloads, validates them, and writes to the time-series store. Auth via project API key.",
        code: `// POST /v1/batch
app.post("/v1/batch", authenticate, async (req, res) => {
  const { calls } = req.body;  // TSCall[]
  const enriched = calls.map(call => ({
    ...call,
    flags: detectFlags(call),   // rule-based optimization flags
    costUSD: computeCost(call), // from pricing table
  }));
  await clickhouse.insert("api_calls", enriched);
  res.json({ accepted: enriched.length });
});

// Example flag rules
function detectFlags(call: TSCall): string[] {
  const flags = [];
  if (call.inputTokens > 2000 && !call.cacheHit)
    flags.push("static_prompt_not_cached");
  if (call.model.includes("opus") && call.inputTokens < 500)
    flags.push("overmodeled");
  if (!call.isBatched && call.feature?.includes("analysis"))
    flags.push("should_batch");
  return flags;
}`,
        tag: "Backend",
        tagColor: C.inkMid,
      },
      {
        title: "Set up ClickHouse for time-series storage",
        detail: "ClickHouse handles billions of rows with sub-second aggregation queries — ideal for cost analytics. One table: api_calls with project_id, feature, model, tokens, cost, timestamp.",
        code: `-- ClickHouse DDL
CREATE TABLE api_calls (
  project_id    String,
  feature       String,
  provider      Enum8('anthropic'=1,'openai'=2,'gemini'=3,'cohere'=4),
  model         String,
  input_tokens  UInt32,
  output_tokens UInt32,
  cost_usd      Float32,
  latency_ms    UInt32,
  flags         Array(String),
  unit_id       String,   -- e.g. matchId for $/match tracking
  ts            DateTime
) ENGINE = MergeTree()
ORDER BY (project_id, ts)
PARTITION BY toYYYYMM(ts);`,
        tag: "Database",
        tagColor: C.accent,
      },
      {
        title: "Build aggregation query layer",
        detail: "Pre-built queries for the dashboard: cost by feature, cost by model, cost per unit (e.g. $/match), daily trend, flagged call rate.",
        code: `-- 1. Cost by feature (last 7 days)
SELECT
  feature,
  sum(cost_usd) AS total,
  count()       AS calls
FROM api_calls
WHERE project_id = ? AND ts >= now() - INTERVAL 7 DAY
GROUP BY feature
ORDER BY total DESC;

-- 2. Cost by provider
SELECT
  provider,
  sum(cost_usd) AS total,
  count()       AS calls
FROM api_calls
WHERE project_id = ? AND ts >= today()
GROUP BY provider;

-- 3. Cost per unit (e.g. $/match for Dream Play)
SELECT
  unit_id,
  sum(cost_usd) AS cost_per_match
FROM api_calls
WHERE project_id = 'dream-play'
GROUP BY unit_id
ORDER BY ts DESC LIMIT 100;`,
        tag: "Analytics",
        tagColor: C.ink,
      },
    ],
  },
  {
    id: "phase3",
    num: "03",
    title: "Dual-Model Agent",
    subtitle: "Anthropic + Gemini powering the optimizer",
    duration: "Week 3–4",
    color: C.anthropic,
    steps: [
      {
        title: "Build the provider-toggle architecture",
        detail: "The agent supports two backends: Anthropic (Claude) and Gemini. Both receive the same system prompt and context. User can switch mid-session. Responses are normalized to the same shape.",
        code: `type AgentResponse = {
  text: string;
  provider: "anthropic" | "gemini";
  model: string;
  tokens: { input: number; output: number };
};

async function callAgent(
  messages: { role: string; text: string }[],
  provider: "anthropic" | "gemini",
  systemPrompt: string
): Promise<AgentResponse> {
  if (provider === "anthropic") return callAnthropic(messages, systemPrompt);
  return callGemini(messages, systemPrompt);
}`,
        tag: "Agent Core",
        tagColor: C.anthropic,
      },
      {
        title: "Anthropic integration (Claude)",
        detail: "Use claude-sonnet-4 for the agent — strong reasoning, cost-efficient. Pass the full call log context and optimization rules in the system prompt.",
        code: `async function callAnthropic(messages, systemPrompt): Promise<AgentResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.text }))
    })
  });
  const d = await res.json();
  return {
    text: d.content[0].text,
    provider: "anthropic",
    model: "claude-sonnet-4",
    tokens: d.usage
  };
}`,
        tag: "Anthropic",
        tagColor: C.anthropic,
      },
      {
        title: "Gemini integration",
        detail: "Use gemini-2.0-flash for the agent — ultra-fast, cheapest option for conversational queries. Map the same message history to Gemini's `contents` format.",
        code: `async function callGemini(messages, systemPrompt): Promise<AgentResponse> {
  const url =
    \`https://generativelanguage.googleapis.com/v1beta/\` +
    \`models/gemini-2.0-flash:generateContent?key=\${process.env.GEMINI_API_KEY}\`;

  // Gemini uses 'model' role (not 'assistant'), and 'parts' not 'content'
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }]
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024 }
    })
  });
  const d = await res.json();
  return {
    text: d.candidates[0].content.parts[0].text,
    provider: "gemini",
    model: "gemini-2.0-flash",
    tokens: d.usageMetadata
  };
}`,
        tag: "Gemini",
        tagColor: C.gemini,
      },
      {
        title: "Shared system prompt with live context injection",
        detail: "One system prompt serves both providers. At call time, inject the user's actual spend data, top features, flagged issues — so both agents give specific, not generic, answers.",
        code: `function buildSystemPrompt(projectData) {
  return \`You are TokenSense, an AI cost optimization agent.

PROJECT: \${projectData.name}
DAILY SPEND: $\${projectData.dailySpend} across \${projectData.features.length} features
TOP COST DRIVER: \${projectData.topFeature} at $\${projectData.topCost}/day
MODELS IN USE: \${projectData.models.join(", ")}

FLAGGED ISSUES:
\${projectData.flags.map(f => \`- \${f.feature}: \${f.issue}\`).join("\\n")}

OPTIMIZATION OPPORTUNITIES:
\${projectData.optimizations.map(o => 
  \`- \${o.title}: saves \${o.saving}\`
).join("\\n")}

Be concise, specific, and technical. Always cite actual numbers from the project data above.
When asked for code, provide copy-paste-ready snippets.\`;
}`,
        tag: "Prompting",
        tagColor: C.accent,
      },
    ],
  },
  {
    id: "phase4",
    num: "04",
    title: "Dashboard",
    subtitle: "Connect prototype to real data",
    duration: "Week 4–5",
    color: C.accent,
    steps: [
      {
        title: "Wire dashboard to ingestion API",
        detail: "Replace mock data in the prototype with live API calls to your ClickHouse query layer. Add a project selector so multiple teams (Dream Play, other Dream Sports AI products) share one dashboard.",
        code: `// Replace MOCK_CALLS with live data
async function fetchCalls(projectId, range = "24h") {
  const res = await fetch(\`/api/calls?\${new URLSearchParams({
    project: projectId,
    range,
    limit: 100
  })}\`, { headers: { "x-api-key": userApiKey } });
  return res.json(); // same TSCall[] shape as mock
}

// Auto-refresh every 30s
useEffect(() => {
  fetchCalls(projectId).then(setCalls);
  const interval = setInterval(() => fetchCalls(projectId).then(setCalls), 30000);
  return () => clearInterval(interval);
}, [projectId]);`,
        tag: "Frontend",
        tagColor: C.accent,
      },
      {
        title: "Add provider breakdown view",
        detail: "New dashboard panel: cost split by provider (Anthropic vs Gemini vs OpenAI). This is the key view for multi-provider teams — shows where each dollar is going across all APIs.",
        code: `// Renders as a proportional bar:
// Anthropic ████████░░░░ $312/day  70%
// Gemini    ███░░░░░░░░░ $98/day   22%
// OpenAI    █░░░░░░░░░░░ $34/day    8%

-- Underlying ClickHouse query
SELECT
  provider,
  sum(cost_usd) AS total,
  count()       AS calls,
  round(100 * sum(cost_usd) / sum(sum(cost_usd)) OVER(), 1) AS pct
FROM api_calls
WHERE project_id = ? AND ts >= today()
GROUP BY provider
ORDER BY total DESC;`,
        tag: "Analytics",
        tagColor: C.gemini,
      },
      {
        title: "Cost-per-unit tracking + experiment comparison",
        detail: "In production: tag with `unitId` (matchId) to track $/match unit economics. In development: tag with `experimentId` to compare the cost of prompt v1 vs v2 vs v3, or model A vs model B — real spend data, not estimates.",
        code: `// 1. Tag at call time in your app
await anthropic.messages.create({
  model: "claude-sonnet-4",
  messages: [...],
  __ts: {
    feature: "game_analysis",
    unitId: matchId,       // ← key for $/match tracking
    projectId: "dream-play"
  }
});

// 2. ClickHouse query: avg cost per match, last 30 days
SELECT
  avg(match_cost) AS avg_cost_per_match,
  min(match_cost) AS min,
  max(match_cost) AS max
FROM (
  SELECT
    unit_id,
    sum(cost_usd) AS match_cost
  FROM api_calls
  WHERE project_id = 'dream-play'
    AND ts >= now() - INTERVAL 30 DAY
  GROUP BY unit_id
);`,
        tag: "Dream Play",
        tagColor: C.anthropic,
      },
    ],
  },
  {
    id: "phase5",
    num: "05",
    title: "Productize",
    subtitle: "From internal tool to SaaS",
    duration: "Month 2–3",
    color: C.gemini,
    steps: [
      {
        title: "Publish SDK to npm + PyPI",
        detail: "Ship `npm install tokensense` and `pip install tokensense`. README shows a 2-line integration. This is the distribution wedge — the easier the install, the faster adoption spreads across Dream Sports AI teams and eventually external teams.",
        code: `# Install
npm install tokensense

# Usage — 2 lines, any provider
import { TokenSense } from "tokensense";
const client = TokenSense.wrap(new Anthropic(), {
  apiKey: "ts_live_...",
  project: "my-app"
});
// Done. Every call is now tracked.`,
        tag: "Distribution",
        tagColor: C.gemini,
      },
      {
        title: "Agent trigger modes — instant, scheduled, and threshold",
        detail: "The agent delivers cost + latency recommendations in three modes. Instant: user asks a question, agent responds with specific fixes and code. Scheduled: a daily 9am digest automatically surfaces regressions, swap recommendations, and estimated savings. Threshold-triggered: fires when cost or latency crosses a set limit — agent explains the cause and pushes a fix, no human needed.",
        code: `// 1. REACTIVE — user asks a question in the dashboard (built)

// 2. SCHEDULED — daily digest via cron
// '0 9 * * *' → runs at 9am every day
cron.schedule('0 9 * * *', async () => {
  const issues = await detectNewIssues(projectId, '24h');
  if (issues.length > 0) {
    await sendSlackDigest({
      text: \`\${issues.length} new issues · $\${issues.totalSaveable}/day saveable\`
    });
  }
});

// 3. THRESHOLD — fires when cost/match crosses limit
if (avgCostPerMatch > THRESHOLD) {
  await callAgent([], 'anthropic', buildSystemPrompt(project));
  // Auto-generates explanation + fix recommendation
}`,
        tag: "Agent Mode",
        tagColor: C.anthropic,
      },
      {
        title: "Pricing model",
        detail: "Free tier: up to 10K calls/month (perfect for small teams). Pro: $49/month unlimited calls + agent. Enterprise: custom + SLA + on-prem ingestion option. The product pays for itself — one optimization recommendation typically saves 10x the subscription cost.",
        code: `TIER        CALLS/MO    AGENT    PROVIDERS    PRICE
──────────────────────────────────────────────────
Free        10,000      No       All          $0/mo
Pro         Unlimited   Yes      All          $49/mo
Enterprise  Unlimited   Yes      All + SLA    Custom

// ROI framing for the sales conversation:
//
// TokenSense identified $234/day in savings for Dream Play
// = $7,020/month in recovered spend
//
// Pro plan cost: $49/month
// ROI: 143x on day one
//
// 'The product pays for itself in the first recommendation.'`,
        tag: "Monetisation",
        tagColor: C.warn,
      },
    ],
  },
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{ position: "relative", marginTop: 12 }}>
      <pre style={{
        background: "#F0EDE8", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "14px 16px", fontSize: 11.5,
        lineHeight: 1.75, color: C.inkMid, fontFamily: "'DM Mono', monospace",
        overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word"
      }}>{code}</pre>
      <button onClick={copy} style={{
        position: "absolute", top: 8, right: 8, background: copied ? C.accent : C.paper,
        border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 9px",
        fontSize: 11, color: copied ? "#fff" : C.inkLight, cursor: "pointer", fontFamily: "system-ui"
      }}>{copied ? "✓ copied" : "copy"}</button>
    </div>
  );
}

export default function Plan() {
  const [openPhase, setOpenPhase] = useState("phase1");
  const [openStep, setOpenStep] = useState(0);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Libre Baskerville', Georgia, serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 2px; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .phase-btn { transition: all 0.15s; cursor: pointer; }
        .phase-btn:hover { background: ${C.tag} !important; }
        .step-row { transition: background 0.1s; cursor: pointer; }
        .step-row:hover { background: ${C.tag} !important; }
      `}</style>

      {/* Masthead */}
      <div style={{ borderBottom: `2px solid ${C.ink}`, padding: "28px 40px 24px", background: C.paper }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.inkLight, marginBottom: 10, fontFamily: "DM Sans", textTransform: "uppercase" }}>
            Implementation Plan · TokenSense v1.0
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: 10 }}>
            Building the Universal<br />AI Cost Intelligence Layer
          </h1>
          <p style={{ fontSize: 15, color: C.inkMid, lineHeight: 1.6, fontStyle: "italic", maxWidth: 580 }}>
            A 5-phase roadmap to intercept, observe, and optimize LLM API spend — across production apps, feature development, and ML experiments. Any provider, any team, any stage.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Anthropic API", color: C.anthropic },
              { label: "Gemini API", color: C.gemini },
              { label: "Provider-agnostic SDK", color: C.accent },
              { label: "Dev · ML · Production", color: C.inkMid },
            ].map((t, i) => (
              <span key={i} style={{
                fontSize: 12, padding: "4px 12px", borderRadius: 20,
                border: `1.5px solid ${t.color}30`, color: t.color,
                background: `${t.color}10`, fontFamily: "DM Sans", fontWeight: 500
              }}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 40px" }}>

        {/* Phase nav pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
          {PHASES.map(p => (
            <button key={p.id} className="phase-btn" onClick={() => { setOpenPhase(p.id); setOpenStep(0); }} style={{
              background: openPhase === p.id ? C.ink : C.paper,
              color: openPhase === p.id ? "#fff" : C.inkMid,
              border: `1.5px solid ${openPhase === p.id ? C.ink : C.border}`,
              borderRadius: 8, padding: "7px 16px", fontSize: 13,
              fontFamily: "DM Sans", fontWeight: 500
            }}>
              <span style={{ opacity: 0.5, marginRight: 6, fontFamily: "DM Mono", fontSize: 11 }}>{p.num}</span>
              {p.title}
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.5 }}>{p.duration}</span>
            </button>
          ))}
        </div>

        {/* Active phase */}
        {PHASES.filter(p => p.id === openPhase).map(phase => (
          <div key={phase.id} style={{ animation: "slideDown 0.25s ease" }}>

            {/* Phase header */}
            <div style={{ borderLeft: `3px solid ${phase.color}`, paddingLeft: 20, marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontFamily: "DM Sans", color: phase.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Phase {phase.num} · {phase.duration}</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{phase.title}</h2>
              <p style={{ fontSize: 14, color: C.inkMid, fontStyle: "italic" }}>{phase.subtitle}</p>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {phase.steps.map((step, i) => (
                <div key={i} style={{ background: C.paper, border: `1.5px solid ${openStep === i ? C.borderDark : C.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div className="step-row" onClick={() => setOpenStep(openStep === i ? -1 : i)}
                    style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, background: openStep === i ? C.tag : "transparent" }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: openStep === i ? C.ink : C.border, color: openStep === i ? "#fff" : C.inkLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "DM Mono", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{step.title}</span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: `${step.tagColor}15`, color: step.tagColor, border: `1px solid ${step.tagColor}30`, fontFamily: "DM Sans", fontWeight: 500, flexShrink: 0 }}>{step.tag}</span>
                    <span style={{ color: C.inkLight, fontSize: 16, marginLeft: 4 }}>{openStep === i ? "−" : "+"}</span>
                  </div>
                  {openStep === i && (
                    <div style={{ padding: "0 20px 20px", animation: "slideDown 0.2s ease" }}>
                      <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.7, marginBottom: 4 }}>{step.detail}</p>
                      <CodeBlock code={step.code} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Phase summary footer */}
            <div style={{ marginTop: 24, padding: "16px 20px", background: `${phase.color}08`, border: `1px solid ${phase.color}25`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.inkMid, fontFamily: "DM Sans" }}>
                {phase.steps.length} steps · {phase.duration}
              </span>
              {openPhase !== PHASES[PHASES.length - 1].id && (
                <button onClick={() => { setOpenPhase(PHASES[PHASES.findIndex(p => p.id === openPhase) + 1].id); setOpenStep(0); }}
                  style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans", fontWeight: 500 }}>
                  Next phase →
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Architecture diagram */}
        <div style={{ marginTop: 40, background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "28px 28px 24px" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Full Architecture · Data Flow</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
            {[
              { label: "Your App", sub: "Any language", color: C.inkLight },
              { arrow: "→" },
              { label: "TokenSense SDK", sub: "npm / pip", color: C.ink },
              { arrow: "→" },
              { label: "Anthropic API", sub: "Claude", color: C.anthropic },
              { arrow: "↕", stack: true },
              { label: "Gemini API", sub: "Flash / Pro", color: C.gemini },
            ].map((item, i) => item.arrow ? (
              <div key={i} style={{ fontSize: item.stack ? 20 : 18, color: C.inkLight, margin: "0 8px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {item.stack ? <span style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans", marginBottom: 2 }}>routes to</span> : null}
                {item.arrow}
              </div>
            ) : (
              <div key={i} style={{ padding: "12px 16px", background: `${item.color}10`, border: `1.5px solid ${item.color}30`, borderRadius: 8, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: "DM Sans" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans" }}>{item.sub}</div>
              </div>
            ))}
            <div style={{ fontSize: 18, color: C.inkLight, margin: "0 8px", flexShrink: 0 }}>→</div>
            <div style={{ padding: "12px 16px", background: `${C.accent}10`, border: `1.5px solid ${C.accent}30`, borderRadius: 8, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "DM Sans" }}>Ingestion API</div>
              <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans" }}>async · non-blocking</div>
            </div>
            <div style={{ fontSize: 18, color: C.inkLight, margin: "0 8px", flexShrink: 0 }}>→</div>
            <div style={{ padding: "12px 16px", background: `${C.ink}08`, border: `1.5px solid ${C.border}`, borderRadius: 8, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: "DM Sans" }}>Dashboard + Agent</div>
              <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans" }}>Claude + Gemini</div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: C.inkLight, fontFamily: "DM Sans", fontStyle: "italic" }}>
            The SDK intercepts calls transparently — your app talks to Anthropic/Gemini directly, telemetry is emitted in the background. Zero latency impact on your critical path.
          </div>
        </div>

      </div>
    </div>
  );
}
